import type {
  GameState, EntityId, DamageType, DomainEvent, WeaponType, WeaponTemplate, EnemyInstance, StatusId, Direction, PlayerActionRejectedEvent,
} from '@dungeon/contracts';
import type { CommandResult } from './shared.js';
import type { SeededRNG } from '../../utils/rng.js';
import { COMBAT, STATUS_DEFAULTS, burn, daggerDisarm, daggerSetTrap, getWeaponDamageProfile, heatSurgeStatus } from '@dungeon/content';
import { buildRegistry } from '../../abilities/registry.js';
import { ALL_ABILITY_DEFINITIONS } from '../../abilities/definitions/index.js';
import { updateRunMetrics } from './shared.js';
import { advanceTurnAfterPlayerAction } from '../turn-advance-pipeline.js';
import { executeAbility } from '../../abilities/runtime/execute-ability.js';
import { resolveAttack } from '../../systems/combat.js';
import { getEffectiveStat, applyStatusToEnemy } from '../../systems/status-effects.js';
import { applyDamageToEnemy } from '../../systems/damage.js';
import { applyDefense, applyRangeAccuracyPenalty } from '../../utils/dice.js';
import { setAbilityCooldown } from '../../systems/abilities.js';
import { validateAbilityAction } from '../../systems/ability-validator.js';
import { rejectPlayerAction } from '../action-rejection.js';
import { checkWeaponMasteryUnlocks } from '../../systems/weapon-mastery.js';
import { chebyshevDistance } from '../../utils/grid.js';

import { handleDisarmTrap } from './disarm-trap.js';
import { handleSetTrap } from './set-trap.js';
import {
  getFireBurnDuration,
  getFireBurnMagnitude,
} from '../../systems/magic-xp.js';
import { processEnemyKill } from '../enemy-death-pipeline.js';

export const LEGACY_CONTENT_ABILITY_HANDLER_IDS = [daggerDisarm.id, daggerSetTrap.id] as const;
const ABILITY_REGISTRY = buildRegistry(ALL_ABILITY_DEFINITIONS);

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

export function handleAttack(
  state: GameState,
  targetId: EntityId,
  rng: SeededRNG,
): CommandResult {
  if (state.run === null) {
    return rejectPlayerAction(
      state,
      'ATTACK',
      targetId,
      'TARGET_NOT_FOUND',
      'No active dungeon run.',
      state.player.id,
      { targetId },
    );
  }
  
  // Check if player is dead
  if (state.player.stats.health <= 0) {
    return rejectPlayerAction(
      state,
      'ATTACK',
      targetId,
      'PLAYER_DEAD',
      'You cannot attack while defeated.',
      state.player.id,
      { targetId },
    );
  }

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

  if (targetEnemy === null || targetKey === null) {
    return rejectPlayerAction(
      state,
      'ATTACK',
      targetId,
      'TARGET_NOT_FOUND',
      'Target not found.',
      state.player.id,
      { targetId },
    );
  }

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
        timestamp: state.turnNumber,
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
  let effectiveAccuracy = getEffectiveStat(state.player.stats.accuracy, 'accuracy', state.player.statuses);
  
  // Apply range accuracy penalty for ranged weapons
  if (weaponRange > 1 || minRange > 0) {
    effectiveAccuracy = applyRangeAccuracyPenalty(
      effectiveAccuracy,
      dist,
      minRange,
      COMBAT.rangedAccuracyDropPerTile,
    );
  }
  
  const defenderDefense = getEffectiveStat(targetEnemy.stats.defense, 'defense', targetEnemy.statuses);
  const weaponDamageType = getEquippedWeaponDamageType(state);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const affinityValue = targetEnemy.affinities?.[weaponDamageType];
  const resistance = affinityValue ?? 0;

  // Extract weapon damage profile and base damage for new combat system
  let weaponDamageProfile: string | undefined;
  let weaponBaseDamage: number | undefined;
  if (state.player.equipment.weapon !== null) {
    const weaponTemplate = state.itemRegistry.items.get(state.player.equipment.weapon);
    if (weaponTemplate !== undefined && weaponTemplate.itemClass === 'weapon') {
      const weapon = (weaponTemplate as WeaponTemplate).weapon;
      weaponDamageProfile = getWeaponDamageProfile(weapon.weaponType, weapon.weaponRange);
      weaponBaseDamage = weapon.damage;
    }
  }

  // DEBUG: Log combat parameters for diagnosis
  const expectedHitChance = Math.max(
    COMBAT.minHitChance,
    Math.min(COMBAT.maxHitChance, COMBAT.baseHitChance + effectiveAccuracy - targetEnemy.stats.evasion),
  );

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
    weaponDamageProfile,
    weaponBaseDamage,
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
    timestamp: state.turnNumber,
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
          timestamp: newState.turnNumber,
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
        timestamp: newState.turnNumber,
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
        timestamp: newState.turnNumber,
        turnNumber: newState.turnNumber,
      }];
    }
    events = [...events, ...statusEvents];

    const heatSurgeActive = newState.player.statuses.some(status => status.id === heatSurgeStatus.id);
    if (heatSurgeActive === true && killed === false) {
      const burnDefaults = STATUS_DEFAULTS.burn;
      const burnDuration = getFireBurnDuration(newState.player, burnDefaults.defaultDuration);
      const burnMagnitude = getFireBurnMagnitude(newState.player);
      updatedEnemy = applyStatusToEnemy(updatedEnemy, burn.id, burnDuration, burnMagnitude, state.player.id);
      events = [...events, {
        type: 'STATUS_APPLIED',
        targetId: targetEnemy.id,
        statusId: burn.id,
        duration: burnDuration,
        sourceId: state.player.id,
        timestamp: newState.turnNumber,
        turnNumber: newState.turnNumber,
      }];
    }

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
      const currentCount = newState.weaponMastery[equippedWeaponType];
      newState = {
        ...newState,
        weaponMastery: {
          ...newState.weaponMastery,
          [equippedWeaponType]: currentCount + 1,
        },
      };
      const masteryResult = checkWeaponMasteryUnlocks(newState, equippedWeaponType);
      newState = masteryResult.state;
      events = [...events, ...masteryResult.events];
    }
  }

  return advanceTurnAfterPlayerAction(newState, events, rng);
}

export function handleUseAbility(
  state: GameState,
  abilityId: string,
  rng: SeededRNG,
  targetId?: EntityId,
  direction?: Direction,
  targetPosition?: { x: number; y: number },
): CommandResult {
  // Route directional abilities to their handlers FIRST (before validation)
  if (abilityId === daggerDisarm.id && direction) {
    return handleDisarmTrap(state, direction as Direction, rng);
  }
  if (abilityId === daggerSetTrap.id && direction && targetId !== undefined) {
    return handleSetTrap(state, direction as Direction, targetId, rng);
  }

  // Validate ability action before executing
  const validation = validateAbilityAction(state, abilityId, targetPosition, targetId, direction);
  if (validation.valid === false) {
    // Use the validator's rejection, don't execute
    return rejectPlayerAction(
      state,
      'ABILITY',
      abilityId,
      validation.rejectionCode,
      validation.message,
      state.player.id,
      { abilityId },
    );
  }
  const definition = ABILITY_REGISTRY.get(abilityId);

  // Execute ability using data-driven engine FIRST (without advancing turn)
  const abilityResult = executeAbility(state, abilityId, rng, targetId, direction, targetPosition);

  // Check if execution was rejected (contains PLAYER_ACTION_REJECTED event)
  const rejectionEvent = abilityResult.events.find(
    (event): event is PlayerActionRejectedEvent => event.type === 'PLAYER_ACTION_REJECTED',
  );

  if (rejectionEvent !== undefined) {
    // Rejection events should not advance turn or consume resources
    return { state: abilityResult.state, events: abilityResult.events, runEnded: false };
  }

  if (abilityResult.events.length === 0) {
    // No events and no rejection: executeAbility should produce at least one event
    // Treat as silent failure and reject
    return rejectPlayerAction(
      state,
      'ABILITY',
      abilityId,
      'EXECUTION_FAILED',
      `${definition?.name ?? 'Unknown ability'} execution produced no observable result.`,
      state.player.id,
      { abilityId },
    );
  }

  // Only advance turn and set cooldown for successful ability execution
  let newState: GameState = {
    ...abilityResult.state,
    turnNumber: abilityResult.state.turnNumber + 1,
  };
  newState = setAbilityCooldown(newState, abilityId, definition?.cooldown ?? 0);
  newState = updateRunMetrics(newState, { turnsElapsed: 1 });

  let resultEvents: DomainEvent[] = [...abilityResult.events];

  return advanceTurnAfterPlayerAction(newState, resultEvents, rng);
}

/** Helper: Complete a quest and emit event. Returns updated state and event. */
