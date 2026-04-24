import type {
  GameState, EntityId, DamageType, DomainEvent, WeaponType, WeaponTemplate, EnemyInstance, StatusId, ItemTemplate, Direction,
} from '@dungeon/contracts';
import type { CommandResult } from './shared.js';
import type { SeededRNG } from '../../utils/rng.js';
import { COMBAT } from '@dungeon/content';
import { updateRunMetrics } from './shared.js';
import { executeAbility } from '../../abilities/runtime/execute-ability.js';
import { resolveAttack } from '../../systems/combat.js';
import { getEffectiveStat, applyStatusToEnemy } from '../../systems/status-effects.js';
import { applyDamageToEnemy } from '../../systems/damage.js';
import { applyDefense } from '../../utils/dice.js';
import { processEnemyLoot } from '../../systems/loot.js';
import { checkLevelUp } from '../../systems/progression.js';
import { slayNemesis } from '../../systems/nemesis.js';
import { updateFactionOnKill } from '../../systems/factions.js';
import { canUseAbility, setAbilityCooldown } from '../../systems/abilities.js';
import { applyLifeStealOnKill, getExpBonusMultiplier } from '../../systems/enchantment-hooks.js';
import { checkWeaponMasteryUnlocks } from '../../systems/weapon-mastery.js';
import { ABILITY_DEFINITIONS, STATUS_DEFAULTS, daggerDisarm, daggerSetTrap } from '@dungeon/content';
import { chebyshevDistance } from '../../utils/grid.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';
import { handleDisarmTrap } from './disarm-trap.js';
import { handleSetTrap } from './set-trap.js';

/** Returns the WeaponType of the currently equipped weapon, or null if none/unknown */
export function getEquippedWeaponType(state: GameState): WeaponType | null {
  if (state.player.equipment.weapon === null) {
    return null;
  }
  const weaponId = state.player.equipment.weapon;
  const tpl = state.itemRegistry.items.get(weaponId);
  if (!tpl || tpl.itemClass !== 'weapon') {
    return null;
  }
  const weaponType = (tpl as WeaponTemplate).weapon.weaponType;
  return weaponType;
}

/** Returns the DamageType of the currently equipped weapon, defaulting to 'physical' */
export function getEquippedWeaponDamageType(state: GameState): DamageType {
  if (state.player.equipment.weapon === null) return 'physical';
  const tpl = state.itemRegistry.items.get(state.player.equipment.weapon);
  if (!tpl || tpl.itemClass !== 'weapon') return 'physical';
  return (tpl as WeaponTemplate).weapon.damageType;
}

/**
 * Processes enemy death: removes from map, awards XP, processes loot, handles quests, nemesis slaying,
 * faction updates, level ups, and victory conditions.
 *
 * This is extracted to ensure feature parity between regular attacks and ability kills.
 */
export function processEnemyKill(
  state: GameState,
  enemy: EnemyInstance,
  enemyPosKey: string,
  rng: SeededRNG,
): { state: GameState, events: DomainEvent[] } {
  let events: DomainEvent[] = [];
  let newState = state;

  // 1. Remove enemy from map
  const newEnemies = new Map(newState.run!.enemies);
  newEnemies.delete(enemyPosKey);

  // 2. Emit ENTITY_DIED
  events = [...events, {
    type: 'ENTITY_DIED',
    entityId: enemy.id,
    killerId: newState.player.id,
    entityName: enemy.name,
    timestamp: Date.now(),
    turnNumber: newState.turnNumber,
  }];

  // 3. Calculate XP with enchantment bonus
  const expGained = Math.round(enemy.experienceValue * getExpBonusMultiplier(newState));

  // 4. Apply life-steal-on-kill
  const lifeStealHp = applyLifeStealOnKill(newState);
  const newHealthAfterSteal = lifeStealHp > 0
    ? Math.min(newState.player.stats.maxHealth, newState.player.stats.health + lifeStealHp)
    : newState.player.stats.health;

  // Emit life steal event if applicable
  if (lifeStealHp > 0) {
    events = [...events, {
      type: 'LIFE_STEAL',
      playerId: newState.player.id,
      enemyId: enemy.id,
      enemyName: enemy.name,
      hpRestored: lifeStealHp,
      timestamp: Date.now(),
      turnNumber: newState.turnNumber,
    }];
  }

  // 5. Update player stats (totalKills, experience, health)
  newState = {
    ...newState,
    run: { ...newState.run!, enemies: newEnemies },
    player: {
      ...newState.player,
      totalKills: newState.player.totalKills + 1,
      experience: newState.player.experience + expGained,
      stats: { ...newState.player.stats, health: newHealthAfterSteal },
    },
  };

  // 6. Process loot + gold tracking
  const goldBeforeLoot = newState.player.gold;
  const lootResult = processEnemyLoot(newState, enemy, rng);
  newState = lootResult.state;
  events = [...events, ...lootResult.events];
  const goldFromLoot = newState.player.gold - goldBeforeLoot;
  if (goldFromLoot > 0) newState = updateRunMetrics(newState, { goldEarned: goldFromLoot });

  // A10.1: Mark nemesis slain if applicable — check nemesisId first
  if (enemy.nemesisId !== undefined) {
    // This enemy IS a named nemesis — slay it
    const killingWeaponType = getEquippedWeaponType(newState);
    const slayResult = slayNemesis(newState, enemy.nemesisId, killingWeaponType ?? undefined);
    newState = slayResult.state;
    events = [...events, ...slayResult.events];
  } else {
    // Double-check: if this enemy template matches an active nemesis, slay it
    const activeNemesis = newState.world.nemeses.find(
      n => n.isActive && n.sourceTemplateId === enemy.templateId
    );
    if (activeNemesis !== undefined) {
      const killingWeaponType = getEquippedWeaponType(newState);
      const slayResult = slayNemesis(newState, activeNemesis.id, killingWeaponType ?? undefined);
      newState = slayResult.state;
      events = [...events, ...slayResult.events];
    }
  }

  // 8. Update faction power
  newState = updateFactionOnKill(newState, enemy.templateId);

  // 9. Track kill metric
  newState = updateRunMetrics(newState, { enemiesKilled: 1 });

  // 10. Check for level up
  const levelResult = checkLevelUp(newState);
  newState = levelResult.state;
  events = [...events, ...levelResult.events];

  // 11. Check quest completion from loot
  for (const lootEvent of lootResult.events) {
    if (lootEvent.type === 'LOOT_ACQUIRED') {
      const itemTemplate = newState.itemRegistry.items.get(lootEvent.itemId);
      if (itemTemplate !== undefined) {
        const completedQuest = newState.activeQuests.find(
          q => q.status === 'active' && q.targetItemId === (itemTemplate as ItemTemplate).itemId,
        );
        if (completedQuest !== undefined) {
          const result = completeQuest(newState, completedQuest);
          newState = result.state;
          events = [...events, result.event];
        }
      }
    }
  }

  // D1: Check quest completion from enemy kill
  const enemyTargetQuests = newState.activeQuests.filter(
    q => q.status === 'active' && q.targetEnemyTemplateId === enemy.templateId,
  );
  for (const quest of enemyTargetQuests) {
    const result = completeQuest(newState, quest);
    newState = result.state;
    events = [...events, result.event];
  }

  // 12. Check victory condition: depth >= 5 and killed a boss (tier >= 4 indicates boss)
  if (newState.run && newState.run.floor.depth >= 5 && enemy.tier >= 4) {
    newState = updateRunMetrics(newState, { causeOfEnd: 'victory' });
    const victoryRun = newState.run!;
    newState = { ...newState, phase: 'game_over' };
    events = [...events, {
      type: 'RUN_ENDED',
      runId: victoryRun.runId,
      reason: 'victory',
      floorsCleared: victoryRun.floor.depth,
      timestamp: Date.now(),
      turnNumber: newState.turnNumber,
    }];
  }

  return { state: newState, events };
}

export function handleAttack(
  state: GameState,
  targetId: EntityId,
  rng: SeededRNG,
): CommandResult {
  if (state.run === null) return { state, events: [], runEnded: false };
  
  // Check if player is dead
  if (state.player.stats.health <= 0) return { state, events: [], runEnded: false };

  // Find the target enemy
  let targetEnemy: EnemyInstance | null = null;
  let targetKey: string | null = null;

  for (const [key, enemy] of state.run.enemies) {
    if (enemy.id === targetId) {
      targetEnemy = enemy;
      targetKey = key;
      break;
    }
  }

  if (targetEnemy === null || targetKey === null) return { state, events: [], runEnded: false };

  // Range check — use equipped weapon's range (default 1 for unarmed/melee)
  const dist = chebyshevDistance(state.player.position, targetEnemy.position);
  let weaponRange = 1;
  let minRange = 0;  // D1: minimum range for ranged weapons
  let weaponName = 'weapon';
  if (state.player.equipment.weapon !== null) {
    const wt = state.itemRegistry.items.get(state.player.equipment.weapon);
    if (wt !== undefined && wt.itemClass === 'weapon') {
      const weapon = (wt as WeaponTemplate).weapon;
      weaponRange = weapon.weaponRange;
      minRange = weapon.minRange ?? 0;  // D1: get minRange if present
      weaponName = wt.name;
    }
  }
  // D1: check both min and max range
  if (dist > weaponRange || dist < minRange) {
    const reason = dist < minRange ? `${targetEnemy.name} is too close to hit with ${weaponName}` : `${targetEnemy.name} is out of range`;
    return {
      state,
      events: [{
        type: 'ATTACK_PERFORMED',
        attackerId: state.player.id,
        defenderId: targetEnemy.id,
        attackerName: state.player.name,
        defenderName: targetEnemy.name,
        damage: 0,
        damageType: 'physical',
        hit: false,
        critical: false,
        position: targetEnemy.position,
        reason,
        timestamp: Date.now(),
        turnNumber: state.turnNumber,
      }],
      runEnded: false,
    };
  }

  let events: DomainEvent[] = [];

  // Get weapon on-hit effects
  let onHitStatus: StatusId | undefined;
  let onHitChance: number | undefined;
  if (state.player.equipment.weapon !== null) {
    const weaponTemplate = state.itemRegistry.items.get(state.player.equipment.weapon);
    if (weaponTemplate !== undefined && weaponTemplate.itemClass === 'weapon') {
      const weapon = (weaponTemplate as WeaponTemplate).weapon;
      onHitStatus = weapon.onHitStatus;
      onHitChance = weapon.onHitChance;
    }
  }

  const effectiveAttack = getEffectiveStat(state.player.stats.attack, 'attack', state.player.statuses);

  // Get effective accuracy (already includes weapon modifier via calculateEquippedStats)
  const effectiveAccuracy = getEffectiveStat(state.player.stats.accuracy, 'accuracy', state.player.statuses);
  const defenderDefense = getEffectiveStat(targetEnemy.stats.defense, 'defense', targetEnemy.statuses);
  const weaponDamageType = getEquippedWeaponDamageType(state);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const affinityValue = targetEnemy.affinities?.[weaponDamageType];
  const resistance = affinityValue ?? 0;

  // DEBUG: Log combat parameters for diagnosis
  const expectedHitChance = Math.max(15, Math.min(95, COMBAT.baseHitChance + effectiveAccuracy - targetEnemy.stats.evasion));

  const result = resolveAttack({
    attackerId: state.player.id,
    defenderId: targetEnemy.id,
    attackerAttack: effectiveAttack,
    attackerAccuracy: effectiveAccuracy,
    defenderDefense: defenderDefense,
    defenderEvasion: targetEnemy.stats.evasion,
    defenderHealth: targetEnemy.stats.health,
    damageType: weaponDamageType,
    defenderResistance: resistance,
  }, rng, onHitStatus, onHitChance);

  // Include diagnostic info for misses
  const debugReason = result.hit === false && result.hitRoll !== undefined
    ? `base:${COMBAT.baseHitChance} +acc:${effectiveAccuracy} -eva:${targetEnemy.stats.evasion} =chance:${expectedHitChance}% roll:${result.hitRoll.toFixed(1)}`
    : undefined;

  events = [...events, {
    type: 'ATTACK_PERFORMED',
    attackerId: state.player.id,
    defenderId: targetEnemy.id,
    attackerName: state.player.name,
    defenderName: targetEnemy.name,
    damage: result.damage,
    damageType: result.damageType,
    hit: result.hit,
    critical: result.criticalHit,
    position: targetEnemy.position,
    reason: debugReason,
    missReason: result.missReason,
    timestamp: Date.now(),
    turnNumber: state.turnNumber,
  }];

  let newState = { ...state, turnNumber: state.turnNumber + 1 };

  // Track turn elapsed
  newState = updateRunMetrics(newState, { turnsElapsed: 1 });

  // Track consecutive misses for streak detection
  if (result.hit === true) {
    // Reset miss counter on hit
    newState = updateRunMetrics(newState, { consecutiveMisses: 0 });
    newState = updateRunMetrics(newState, { damageDealt: result.damage });
  } else {
    // Increment miss counter on miss
    const newMissCount = (newState.run?.runMetrics?.consecutiveMisses ?? 0) + 1;
    newState = updateRunMetrics(newState, { consecutiveMisses: newMissCount });

    // Emit debug event on 6+ consecutive misses
    if (newMissCount >= 6) {
      const lastEnemy = newState.run !== null ? [...newState.run.enemies.values()][0] : undefined;
      if (lastEnemy !== undefined) {
        const debugEvent: DomainEvent = {
          type: 'DEBUG_MISS_STREAK',
          playerAccuracy: state.player.stats.accuracy,
          playerEvasion: state.player.stats.evasion,
          enemyAccuracy: lastEnemy.stats.accuracy,
          enemyEvasion: lastEnemy.stats.evasion,
          rngSeed: newState.seed,
          streakLength: newMissCount,
          timestamp: Date.now(),
          turnNumber: newState.turnNumber,
        };
        events = [...events, debugEvent];
      }
    }
  }

  if (result.hit === true) {
    // Apply damage through central damage system (bypassing defense/resistance since resolveAttack already applied them)
    const damageResult = applyDamageToEnemy(newState, targetEnemy.id, {
      amount: result.damage,
      damageType: result.damageType,
      source: 'attack',
      bypassDefense: true,
      bypassResistance: true,
      isCritical: result.criticalHit,
    });
    newState = damageResult.state;
    const killed = damageResult.killed;

    // Add debug damage event if debug mode enabled.
    // resolveAttack already applied defense/resistance, so damageResult's debugInfo
    // shows a bypassed breakdown. Reconstruct the full breakdown from ctx + result.
    if (newState.debugMode === true) {
      const rawDamage = result.damage + result.mitigated;
      const postDefense = applyDefense(rawDamage, targetEnemy.stats.defense, COMBAT.defenseDivisor);
      const postResistance = resistance > 0
        ? Math.max(COMBAT.minDamage, Math.round(postDefense * (1 - resistance)))
        : postDefense;
      const debugEvent: DomainEvent = {
        type: 'DEBUG_DAMAGE_CALC',
        targetName: targetEnemy.name,
        source: 'attack',
        rawDamage,
        postDefense,
        postResistance,
        finalDamage: result.damage,
        defense: targetEnemy.stats.defense,
        resistance,
        bypassDefense: false,
        bypassResistance: false,
        isCrit: result.criticalHit,
        critMultiplier: result.criticalHit === true ? COMBAT.critMultiplier : 1,
        timestamp: Date.now(),
        turnNumber: newState.turnNumber,
      };
      events = [...events, debugEvent];
    }

    // Apply on-hit statuses
    let updatedEnemy = newState.run?.enemies.get(targetKey);
    if (updatedEnemy === undefined) {
      updatedEnemy = targetEnemy;  // Fallback if enemy not found
    }

    let statusEvents: DomainEvent[] = [];
    for (const statusId of result.statusesApplied) {
      const defaults = STATUS_DEFAULTS[statusId];
      const duration = 'defaultDuration' in defaults ? (defaults as { defaultDuration: number }).defaultDuration : 3;
      updatedEnemy = applyStatusToEnemy(updatedEnemy, statusId, duration, 1, state.player.id);
      statusEvents = [...statusEvents, {
        type: 'STATUS_APPLIED',
        targetId: targetEnemy.id,
        statusId,
        duration,
        sourceId: state.player.id,
        timestamp: Date.now(),
        turnNumber: newState.turnNumber,
      }];
    }
    events = [...events, ...statusEvents];

    if (killed === true) {
      // Enemy died — use shared kill handling logic
      const killResult = processEnemyKill(newState, targetEnemy, targetKey, rng);
      newState = killResult.state;
      events = [...events, ...killResult.events];
    } else {
      // Enemy survived — update with on-hit status changes
      const newEnemies = new Map(newState.run!.enemies);
      newEnemies.set(targetKey, updatedEnemy);
      newState = {
        ...newState,
        run: { ...newState.run!, enemies: newEnemies },
      };
    }

    // Track mastery hit count
    const equippedWeaponType = getEquippedWeaponType(newState);
    if (newState.run !== null && equippedWeaponType !== null) {
      const currentCount = newState.run.weaponMastery[equippedWeaponType];
      newState = {
        ...newState,
        run: {
          ...newState.run,
          weaponMastery: {
            ...newState.run.weaponMastery,
            [equippedWeaponType]: currentCount + 1,
          },
        },
      };
      const masteryResult = checkWeaponMasteryUnlocks(newState, equippedWeaponType);
      newState = masteryResult.state;
      events = [...events, ...masteryResult.events];
    }
  }

  // Process enemy turns with player speed for speed-based action accumulation, then tick ability cooldowns
  const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
  newState = enemyResult.state;
  events = [...events, ...enemyResult.events];
  newState = tickAbilityCooldowns(newState);

  const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
  return { state: newState, events, runEnded };
}

export function handleUseAbility(
  state: GameState,
  abilityId: string,
  rng: SeededRNG,
  targetId?: EntityId,
  direction?: Direction,
): CommandResult {
  if (state.run === null) return { state, events: [], runEnded: false };
  if (canUseAbility(state, abilityId) !== true) return { state, events: [], runEnded: false };

  const def = ABILITY_DEFINITIONS.get(abilityId);
  if (def === undefined) return { state, events: [], runEnded: false };

  // Check weapon type requirement for mastery abilities
  if (Array.isArray(def.requiresWeaponTypes) && def.requiresWeaponTypes.length > 0) {
    const equippedType = getEquippedWeaponType(state);
    if (!equippedType || !def.requiresWeaponTypes.includes(equippedType)) return { state, events: [], runEnded: false };
  }

  // Route directional abilities to their handlers
  if (abilityId === daggerDisarm.id && direction) {
    return handleDisarmTrap(state, direction as Direction, rng);
  }
  if (abilityId === daggerSetTrap.id && direction && targetId) {
    return handleSetTrap(state, direction as Direction, targetId, rng);
  }

  // Pre-set cooldown and turn tracking
  let newState: GameState = {
    ...state,
    turnNumber: state.turnNumber + 1,
  };
  newState = setAbilityCooldown(newState, abilityId, def.cooldown);
  newState = updateRunMetrics(newState, { turnsElapsed: 1 });

  // Execute ability using data-driven engine
  const abilityResult = executeAbility(newState, abilityId, rng, targetId);
  if (abilityResult.events.length === 0) {
    // Ability not found or failed validation
    return { state: newState, events: [], runEnded: false };
  }

  let resultState = abilityResult.state;
  let resultEvents: DomainEvent[] = [...abilityResult.events];

  // Enemy turns with player speed for speed-based action accumulation, then tick cooldowns
  const enemyResult = processEnemyTurns(resultState, rng, resultState.player.stats.speed);
  resultState = enemyResult.state;
  resultEvents = [...resultEvents, ...enemyResult.events];
  resultState = tickAbilityCooldowns(resultState);

  const runEnded = resultState.phase === 'town' || resultState.phase === 'game_over';
  return { state: resultState, events: resultEvents, runEnded };
}

/** Helper: Complete a quest and emit event. Returns updated state and event. */
function completeQuest(
  state: GameState,
  quest: GameState['activeQuests'][number],
): { state: GameState; event: DomainEvent } {
  const updatedState = {
    ...state,
    activeQuests: state.activeQuests.map(q =>
      q.id === quest.id ? { ...q, status: 'complete' as const } : q,
    ),
    player: { ...state.player, gold: state.player.gold + quest.rewardGold },
  };
  const event: DomainEvent = {
    type: 'QUEST_COMPLETED',
    questId: quest.id,
    questTitle: quest.title,
    rewardGold: quest.rewardGold,
    timestamp: Date.now(),
    turnNumber: state.turnNumber,
  };
  return { state: updatedState, event };
}
