import type { GameState, EnemyInstance } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { decideEnemyAction, type EnemyAction } from '../systems/enemy-ai.js';
import { decideAmbientAction } from '../systems/ambient-behavior-engine.js';
import { resolveAttack } from '../systems/combat.js';
import { getEffectiveStat, tickPlayerStatuses, tickEnemyStatuses } from '../systems/status-effects.js';
import { applyRangeAccuracyPenalty } from '../utils/dice.js';
import { handlePlayerDeath } from '../systems/death.js';
import { applyDamageToPlayer, createDamageDebugEvent } from '../systems/damage.js';
import { chebyshevDistance } from '../utils/grid.js';
import type { SeededRNG } from '../utils/rng.js';
import { applyThornsToAttacker, applyBlinkOnHit, getEnchantmentRegenBonus, getTotalThornsReflect } from '../systems/enchantment-hooks.js';
import { updateRunMetrics } from './command-handler.js';
import { processEnemyKill } from './enemy-death-pipeline.js';
import { resolveEnemyAbility } from '../systems/enemy-abilities.js';
import { COMBAT, AMBIENT_PROFILES, OBJECT_TEMPLATES } from '@dungeon/content';
import { calculateHazardDamage, hazardTypeToDamageType } from '../systems/hazard-damage.js';
import { applyDamageToEnemy } from '../systems/damage.js';

/** Process all enemy turns after a player action */
export function processEnemyTurns(
  state: GameState,
  rng: SeededRNG,
  playerSpeed?: number,
): { state: GameState; events: DomainEvent[] } {
  if (state.run === null) return { state, events: [] };

  let currentState = state;
  let allEvents: DomainEvent[] = [];

  // Update speed accumulators if playerSpeed provided (for MOVE actions only)
  if (playerSpeed !== undefined && currentState.run !== null) {
    const newAccumulators: Record<string, number> = { ...currentState.run.speedAccumulators };
    for (const enemy of currentState.run.enemies.values()) {
      const ratio = enemy.stats.speed / playerSpeed;
      newAccumulators[enemy.id] = (newAccumulators[enemy.id] ?? 0) + ratio;
    }
    currentState = {
      ...currentState,
      run: { ...currentState.run, speedAccumulators: newAccumulators },
    };
  }

  // Sort enemies by speed (fastest first)
  const mutableEnemiesBySpeed = [...currentState.run!.enemies.values()]
    .filter(e => e.stats.health > 0);
  mutableEnemiesBySpeed.sort((a, b) => b.stats.speed - a.stats.speed);
  const enemies = mutableEnemiesBySpeed;

  for (const enemy of enemies) {
    // Inner loop: enemy may act multiple times if speed is high enough
    // When playerSpeed is undefined, each enemy acts exactly once (no speed system)
    let actionsThisTurn = 0;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      if (currentState.player.stats.health <= 0) break;
      if (currentState.run === null) break;

      // Check speed accumulator — skip enemy if below threshold when playerSpeed provided
      if (playerSpeed !== undefined) {
        const accumulator = currentState.run.speedAccumulators[enemy.id] ?? 0;
        if (accumulator < 1) break; // Enemy skips this turn (player is relatively faster)
      } else {
        if (actionsThisTurn >= 1) break; // Without speed system, each enemy acts once
      }

      // Reacquire by stable id so movers can spend follow-up actions after changing position.
      const currentEnemy = findEnemyById(currentState.run.enemies, enemy.id);
      if (currentEnemy === undefined) break; // Enemy dead or removed

      // Alert check
      let updatedEnemy = currentEnemy;
      if (currentEnemy.isAlerted !== true) {
        const dist = chebyshevDistance(currentEnemy.position, currentState.player.position);
        if (dist <= 5) {
          updatedEnemy = { ...currentEnemy, isAlerted: true, lastKnownPlayerPos: currentState.player.position };
          const newEnemies = new Map(currentState.run.enemies);
          newEnemies.delete(posKey(currentEnemy.position));
          newEnemies.set(posKey(updatedEnemy.position), updatedEnemy);
          currentState = {
            ...currentState,
            run: { ...currentState.run, enemies: newEnemies },
          };
          let alertEvents: DomainEvent[] = [{
            type: 'ENEMY_ALERTED',
            enemyId: updatedEnemy.id,
            enemyName: updatedEnemy.name,
            timestamp: currentState.turnNumber,
            turnNumber: currentState.turnNumber,
          }];

          // Alert propagation: notify nearby un-alerted enemies
          const neighborsToAlert = Array.from(currentState.run!.enemies.values())
            .filter(neighbor => !neighbor.isAlerted && chebyshevDistance(neighbor.position, updatedEnemy.position) <= 4);

          let updatedRunState = currentState.run!;
          let neighborAlertEvents: DomainEvent[] = [];
          for (const neighbor of neighborsToAlert) {
            const alertedNeighbor = { ...neighbor, isAlerted: true, lastKnownPlayerPos: currentState.player.position };
            const newEnemies = new Map(updatedRunState.enemies);
            newEnemies.delete(posKey(neighbor.position));
            newEnemies.set(posKey(alertedNeighbor.position), alertedNeighbor);
            updatedRunState = { ...updatedRunState, enemies: newEnemies };
            neighborAlertEvents = [...neighborAlertEvents, {
              type: 'ENEMY_ALERTED',
              enemyId: alertedNeighbor.id,
              enemyName: alertedNeighbor.name,
              timestamp: currentState.turnNumber,
              turnNumber: currentState.turnNumber,
            }];
          }
          currentState = { ...currentState, run: updatedRunState };
          allEvents = [...allEvents, ...alertEvents, ...neighborAlertEvents];
        }
      }

      // Stun check (applies to both alerted and ambient behaviors)
      if (updatedEnemy.statuses.some(s => s.id === 'stun')) break;

      // Decide action based on alert state
      let action: EnemyAction;
      let ambientStateChangeEvent: DomainEvent | null = null;

      if (updatedEnemy.isAlerted === true) {
        // Combat behavior
        action = decideEnemyAction(updatedEnemy, currentState);
      } else {
        // Ambient behavior
        const profileId = updatedEnemy.ambientBehaviorProfile;
        const profile = profileId !== undefined ? AMBIENT_PROFILES.get(profileId) : undefined;
        if (profile !== undefined) {
          const ambientResult = decideAmbientAction(updatedEnemy, profile, currentState, rng);
          action = ambientResult.action;
          updatedEnemy = ambientResult.updatedEnemy;
          ambientStateChangeEvent = ambientResult.stateChangeEvent;
        } else {
          action = { type: 'wait', enemyId: updatedEnemy.id };
          // Still age the state even without a profile
          updatedEnemy = { ...updatedEnemy, ambientStateAge: (updatedEnemy.ambientStateAge ?? 0) + 1 };
        }
      }

      const result = executeEnemyAction(action, updatedEnemy, currentState, rng);
      currentState = result.state;
      allEvents = [...allEvents, ...result.events];
      if (ambientStateChangeEvent !== null) {
        allEvents = [...allEvents, ambientStateChangeEvent];
      }
      actionsThisTurn++;

      // Decrement speed accumulator after this action
      if (playerSpeed !== undefined && currentState.run !== null) {
        const newAccumulators = { ...currentState.run.speedAccumulators };
        newAccumulators[enemy.id] = (newAccumulators[enemy.id] ?? 0) - 1;
        currentState = {
          ...currentState,
          run: {
            ...currentState.run,
            speedAccumulators: newAccumulators,
          },
        };
      }
    }
  }

  // Tick player statuses at end of round (DoT damage routed through central damage system)
  const healthBeforeStatus = currentState.player.stats.health;
  const statusResult = tickPlayerStatuses(currentState, currentState.turnNumber, rng);
  currentState = statusResult.state;
  allEvents = [...allEvents, ...statusResult.events];
  const statusDamage = healthBeforeStatus - currentState.player.stats.health;
  if (statusDamage > 0) {
    currentState = updateRunMetrics(currentState, { damageTaken: statusDamage });
  }

  // Apply enchantment HP regen
  const regenBonus = getEnchantmentRegenBonus(currentState);
  if (regenBonus > 0 && currentState.player.stats.health > 0) {
    const newHealth = Math.min(currentState.player.stats.maxHealth, currentState.player.stats.health + regenBonus);
    currentState = {
      ...currentState,
      player: { ...currentState.player, stats: { ...currentState.player.stats, health: newHealth } },
    };
  }

  // Check player death from status damage (only if run is still active)
  if (currentState.run !== null && currentState.player.stats.health <= 0) {
    const deathResult = handlePlayerDeath(currentState, null, 'status effects', rng, Math.abs(currentState.player.stats.health));
    currentState = deathResult.state;
    allEvents = [...allEvents, ...deathResult.events];
  }

  // Tick enemy statuses at end of round
  if (currentState.run !== null) {
    let statusEvents: DomainEvent[] = [];
    const enemiesToTick = Array.from(currentState.run.enemies.values());
    for (const enemy of enemiesToTick) {
      const statusResult = tickEnemyStatuses(currentState, enemy, currentState.turnNumber);
      currentState = statusResult.state;
      statusEvents = [...statusEvents, ...statusResult.events];

      if (currentState.run === null) {
        break;
      }

      const currentEnemy = currentState.run.enemies.get(posKey(enemy.position));
      if (currentEnemy !== undefined && currentEnemy.stats.health <= 0) {
        const killResult = processEnemyKill(currentState, currentEnemy, posKey(currentEnemy.position), rng);
        currentState = killResult.state;
        statusEvents = [...statusEvents, ...killResult.events];
      }
    }
    allEvents = [...allEvents, ...statusEvents];
  }

  // Tick enemy ability cooldowns
  currentState = tickEnemyCooldowns(currentState);

  return { state: currentState, events: allEvents };
}


/** Tick down all enemy ability cooldowns at the end of a round */
export function tickEnemyCooldowns(state: GameState): GameState {
  if (state.run === null) return state;

  const newEnemies = new Map(state.run.enemies);
  for (const [key, enemy] of newEnemies) {
    if (enemy.abilityCooldowns === undefined || Object.keys(enemy.abilityCooldowns).length === 0) continue;

    const updatedCooldowns: Record<string, number> = {};
    for (const [abilityId, cooldown] of Object.entries(enemy.abilityCooldowns)) {
      updatedCooldowns[abilityId] = Math.max(0, cooldown - 1);
    }

    newEnemies.set(key, {
      ...enemy,
      abilityCooldowns: updatedCooldowns,
    });
  }

  return {
    ...state,
    run: { ...state.run, enemies: newEnemies },
  };
}

function executeEnemyAction(
  action: EnemyAction,
  enemy: EnemyInstance,
  state: GameState,
  rng: SeededRNG,
): { state: GameState; events: DomainEvent[] } {
  if (state.run === null) return { state, events: [] };

  switch (action.type) {
    case 'move': {
      if (action.targetPosition === undefined) return { state, events: [] };

      const newEnemies = new Map(state.run.enemies);
      newEnemies.delete(posKey(enemy.position));

      // If the target cell is already occupied by another enemy, the enemy waits
      if (newEnemies.has(posKey(action.targetPosition))) {
        return { state, events: [] };
      }

      const movedEnemy: EnemyInstance = {
        ...enemy,
        position: action.targetPosition,
        lastKnownPlayerPos: state.player.position,
      };
      newEnemies.set(posKey(action.targetPosition), movedEnemy);

      let newState = {
        ...state,
        run: { ...state.run, enemies: newEnemies },
      };

      let events: DomainEvent[] = [{
        type: 'ENEMY_MOVED',
        enemyId: enemy.id,
        from: enemy.position,
        to: action.targetPosition,
        timestamp: state.turnNumber,
        turnNumber: state.turnNumber,
      }];

      // Check for hazards at the new position
      const objKey = posKey(action.targetPosition);
      const hazardAtPos = state.run.objects.get(objKey);
      if (hazardAtPos !== undefined) {
        const hazardTemplate = OBJECT_TEMPLATES.get(hazardAtPos.templateId);
        if (hazardTemplate !== undefined && hazardTemplate.isHazard === true) {
          const trapDamage = calculateHazardDamage(hazardTemplate, movedEnemy.stats.maxHealth);
          const damageType = hazardTemplate.hazardType !== undefined ? hazardTypeToDamageType(hazardTemplate.hazardType) : 'physical';

          // Apply damage through central function (applies defense and resistance)
          const damageResult = applyDamageToEnemy(newState as GameState, movedEnemy.id, {
            amount: trapDamage,
            damageType,
            source: 'trap',
            sourceId: hazardAtPos.id,
          });
          newState = damageResult.state as typeof newState;

          events = [...events, {
            type: 'TRAP_TRIGGERED',
            trapId: hazardAtPos.id,
            trapName: hazardTemplate.name,
            position: action.targetPosition,
            damage: damageResult.finalDamage,
            rarity: hazardTemplate.rarity,
            hazardType: hazardTemplate.hazardType,
            statusEffect: hazardTemplate.statusEffect,
            timestamp: state.turnNumber,
            turnNumber: state.turnNumber,
          }];

          // Handle enemy death from hazard (if killed by trap)
          if (damageResult.killed === true) {
            events = [...events, {
              type: 'ENTITY_DIED',
              entityId: movedEnemy.id,
              killerId: null,
              entityName: movedEnemy.name,
              timestamp: state.turnNumber,
              turnNumber: state.turnNumber,
            }];
          }
        }
      }

      return { state: newState, events };
    }

    case 'attack': {
      const effectiveAttack = getEffectiveStat(enemy.stats.attack, 'attack', enemy.statuses);
      let effectiveAccuracy = getEffectiveStat(enemy.stats.accuracy, 'accuracy', enemy.statuses);
      const playerDefense = getEffectiveStat(state.player.stats.defense, 'defense', state.player.statuses);
      const playerEvasion = state.player.stats.evasion;

      // Apply range accuracy penalty for ranged weapons
      let weaponRange = 1;
      let minRange = 0;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (enemy.equipment?.weapon !== undefined) {
        weaponRange = enemy.equipment.weapon.weaponRange;
        minRange = enemy.equipment.weapon.minRange ?? 0;
      }
      if (weaponRange > 1 || minRange > 0) {
        const dist = chebyshevDistance(enemy.position, state.player.position);
        effectiveAccuracy = applyRangeAccuracyPenalty(
          effectiveAccuracy,
          dist,
          minRange,
          COMBAT.rangedAccuracyDropPerTile,
        );
      }

      // Determine enemy damage type from equipment or default to physical
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const damageType = enemy.equipment?.weapon?.damageType ?? 'physical';

      // Player resistance from enchantments/armor (safe access)
      const resistance = (state.player.stats.resistances ?? {})[damageType] ?? 0;

      // Check blink before resolving damage
      const blinked = applyBlinkOnHit(state, () => rng.next());

      const result = resolveAttack({
        attackerId: enemy.id,
        defenderId: state.player.id,
        attackerAttack: effectiveAttack,
        attackerAccuracy: effectiveAccuracy,
        defenderDefense: playerDefense,
        defenderEvasion: blinked === true ? 100 : playerEvasion, // blink = guaranteed miss
        defenderHealth: state.player.stats.health,
        damageType,
        defenderResistance: resistance,
      }, rng);

      // Include diagnostic info for misses
      const expectedHitChance = Math.max(
        COMBAT.minHitChance,
        Math.min(COMBAT.maxHitChance, COMBAT.baseHitChance + effectiveAccuracy - playerEvasion),
      );
      const debugReason = result.hit === false && result.hitRoll !== undefined
        ? `base:${COMBAT.baseHitChance} +acc:${effectiveAccuracy} -eva:${playerEvasion} =chance:${expectedHitChance}% roll:${result.hitRoll.toFixed(1)}`
        : undefined;

      const attackEvent: DomainEvent = {
        type: 'ATTACK_PERFORMED',
        attackerId: enemy.id,
        defenderId: state.player.id,
        attackerName: enemy.name,
        defenderName: state.player.name,
        damage: result.damage,
        damageType: result.damageType,
        hit: result.hit,
        critical: result.criticalHit,
        position: state.player.position,
        reason: debugReason,
        missReason: result.missReason,
        timestamp: state.turnNumber,
        turnNumber: state.turnNumber,
      };

      let newState = state;
      let resultEvents: DomainEvent[] = [attackEvent];

      // Track consecutive misses for streak detection
      if (result.hit === true) {
        // Reset miss counter on enemy hit
        newState = updateRunMetrics(newState, { consecutiveMisses: 0 });
      } else {
        // Increment miss counter on enemy miss
        const newMissCount = (newState.run?.runMetrics?.consecutiveMisses ?? 0) + 1;
        newState = updateRunMetrics(newState, { consecutiveMisses: newMissCount });

        // Emit debug event on 6+ consecutive misses
        if (newMissCount >= 6) {
          const debugEvent: DomainEvent = {
            type: 'DEBUG_MISS_STREAK',
            playerAccuracy: newState.player.stats.accuracy,
            playerEvasion: newState.player.stats.evasion,
            enemyAccuracy: enemy.stats.accuracy,
            enemyEvasion: enemy.stats.evasion,
            rngSeed: newState.seed,
            streakLength: newMissCount,
            timestamp: newState.turnNumber,
            turnNumber: newState.turnNumber,
          };
          resultEvents = [...resultEvents, debugEvent];
        }
      }

      // Emit blink dodge event if applicable
      if (blinked === true) {
        resultEvents = [...resultEvents, {
          type: 'BLINK_DODGED',
          defenderId: state.player.id,
          attackerId: enemy.id,
          attackerName: enemy.name,
          timestamp: state.turnNumber,
          turnNumber: state.turnNumber,
        }];
      }

      if (result.hit === true) {
        // Apply damage through central damage system (bypassing defense/resistance since resolveAttack already applied them)
        const damageResult = applyDamageToPlayer(newState, {
          amount: result.damage,
          damageType: result.damageType,
          source: 'attack',
          bypassDefense: true,
          bypassResistance: true,
          isCritical: result.criticalHit,
        });
        newState = damageResult.state;
        const playerKilled = damageResult.killed;

        // Add debug damage event if debug mode enabled
        if (newState.debugMode === true) {
          const debugEvent = createDamageDebugEvent(state.player.name, damageResult, 'attack');
          if (debugEvent !== null) {
            resultEvents = [...resultEvents, { ...debugEvent, turnNumber: newState.turnNumber }];
          }
        }

        newState = updateRunMetrics(newState, { damageTaken: result.damage });

        // Thorns: reflect damage to attacker (bypasses defense and resistance)
        const thornsAmount = getTotalThornsReflect(newState);
        if (thornsAmount > 0) {
          const thornsResult = applyThornsToAttacker(newState as GameState, enemy, thornsAmount);
          newState = thornsResult.state;
          const thornsEvent: DomainEvent = {
            type: 'THORNS_REFLECTED',
            targetId: enemy.id,
            targetName: enemy.name,
            damageAmount: thornsResult.finalDamage,
            byPlayerId: state.player.id,
            timestamp: state.turnNumber,
            turnNumber: state.turnNumber,
          };
          resultEvents = [...resultEvents, thornsEvent];

          // Add debug damage event if debug mode enabled
          if (newState.debugMode === true) {
            const debugEvent = createDamageDebugEvent(enemy.name, thornsResult, 'thorns');
            if (debugEvent !== null) {
              resultEvents = [...resultEvents, { ...debugEvent, turnNumber: newState.turnNumber }];
            }
          }
        }

        if (playerKilled === true) {
          const rawHealth = state.player.stats.health - result.damage;
          const deathResult = handlePlayerDeath(newState, enemy.id, `Killed by ${enemy.name}`, rng, Math.abs(rawHealth));
          return {
            state: deathResult.state,
            events: [...resultEvents, ...deathResult.events],
          };
        }
      }

      return { state: newState, events: resultEvents };
    }

    case 'ability': {
      if (action.abilityId === undefined) return { state, events: [] };

      const result = resolveEnemyAbility(action.abilityId, enemy, state, rng);
      let newState = result.state;

      // Update run metrics for any damage dealt by the ability
      for (const event of result.events) {
        if (event.type === 'ATTACK_PERFORMED' && event.hit === true && event.damage > 0) {
          newState = updateRunMetrics(newState, { damageTaken: event.damage });
        }
      }

      return { state: newState, events: result.events };
    }

    case 'wait':
    default:
      return { state, events: [] };
  }
}

function findEnemyById(
  enemies: ReadonlyMap<string, EnemyInstance>,
  enemyId: EnemyInstance['id'],
): EnemyInstance | undefined {
  for (const enemy of enemies.values()) {
    if (enemy.id === enemyId) {
      return enemy;
    }
  }

  return undefined;
}
