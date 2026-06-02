import type { Player, EnemyInstance, EntityId, StatusId, GameState, DamageType } from '@dungeon/contracts';
import type { StatusEffect } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
import { posKey } from '@dungeon/contracts';
import { MAGIC, STATUS_DEFAULTS } from '@dungeon/content';
import { applyDamageToPlayer, applyDamageToEnemy, createDamageDebugEvent } from './damage.js';
import { processEnemyKill } from '../engine/enemy-death-pipeline.js';

/** Map status IDs that deal damage to their damage types */
function statusToDamageType(statusId: StatusId): DamageType | null {
  const map: Record<StatusId, DamageType | null> = {
    poison: 'poison',
    burn: 'fire',
    bleed: 'physical',
    slow: null,
    stun: null,
    weaken: null,
    vulnerability: null,
    strength: null,
    regeneration: null,
    panic: null,
    heat_surge: null,
    arcane_charge: null,
    storm_active: null,
  };
  return map[statusId] ?? null;
}

function getStatusDamageAmount(status: StatusEffect): number | null {
  const defaults = STATUS_DEFAULTS[status.id];
  if (!('damagePerTurn' in defaults)) return null;
  const baseDamage = (defaults as { damagePerTurn: number }).damagePerTurn;
  if (status.id !== 'burn') return baseDamage;
  return baseDamage + Math.max(0, status.magnitude - 1);
}

function createStatusDamageTickEvent(args: {
  readonly damage: number;
  readonly damageType: DamageType;
  readonly statusId: StatusId;
  readonly targetId: EntityId;
  readonly targetName: string;
  readonly turnNumber: number;
}): DomainEvent {
  return {
    type: 'STATUS_DAMAGE_TICK',
    targetId: args.targetId,
    targetName: args.targetName,
    statusId: args.statusId,
    damage: args.damage,
    damageType: args.damageType,
    timestamp: args.turnNumber,
    turnNumber: args.turnNumber,
  };
}

function applyStatusEffect<T extends { readonly statuses: readonly StatusEffect[] }>(
  entity: T,
  statusId: StatusId,
  duration: number,
  magnitude: number,
  sourceId: EntityId | null,
): T {
  // Don't stack — refresh duration instead
  const existing = entity.statuses.find(s => s.id === statusId);
  if (existing !== undefined) {
    if (statusId === 'arcane_charge') {
      return {
        ...entity,
        statuses: entity.statuses.map(s =>
          s.id === statusId
            ? {
                ...s,
                turnsRemaining: Math.max(s.turnsRemaining, duration),
                magnitude: Math.min(MAGIC.arcaneChargeMaxStacks, s.magnitude + magnitude),
              }
            : s,
        ),
      } as T;
    }

    return {
      ...entity,
      statuses: entity.statuses.map(s =>
        s.id === statusId
          ? { ...s, turnsRemaining: Math.max(s.turnsRemaining, duration), magnitude: Math.max(s.magnitude, magnitude) }
          : s,
      ),
    } as T;
  }

  const effect: StatusEffect = { id: statusId, turnsRemaining: duration, magnitude, sourceId };
  return { ...entity, statuses: [...entity.statuses, effect] } as T;
}

/** Apply a new status effect to the player */
export function applyStatusToPlayer(
  player: Player,
  statusId: StatusId,
  duration: number,
  magnitude: number,
  sourceId: EntityId | null,
): Player {
  return applyStatusEffect(player, statusId, duration, magnitude, sourceId);
}

/** Apply a status to an enemy */
export function applyStatusToEnemy(
  enemy: EnemyInstance,
  statusId: StatusId,
  duration: number,
  magnitude: number,
  sourceId: EntityId | null,
): EnemyInstance {
  return applyStatusEffect(enemy, statusId, duration, magnitude, sourceId);
}

/** Tick all status effects on the player, returning updated player + events */
export function tickPlayerStatuses(
  state: GameState,
  turnNumber: number,
  rng?: SeededRNG,
): { state: GameState; events: DomainEvent[] } {
  let currentState = state;
  let allEvents: DomainEvent[] = [];

  // Apply damage from damaging statuses via central damage system
  for (const status of state.player.statuses) {
    const defaults = STATUS_DEFAULTS[status.id];
    const damageAmount = getStatusDamageAmount(status);
    if (damageAmount !== null) {
      const damageType = statusToDamageType(status.id);
      // DoT only applies resistance, not defense
      const damageResult = applyDamageToPlayer(currentState, {
        amount: damageAmount,
        damageType: damageType ?? 'physical',
        source: 'dot',
        bypassDefense: true,
        bypassResistance: false,
      });
      currentState = damageResult.state;
      if (damageResult.finalDamage > 0) {
        allEvents = [...allEvents, createStatusDamageTickEvent({
          damage: damageResult.finalDamage,
          damageType: damageType ?? 'physical',
          statusId: status.id,
          targetId: currentState.player.id,
          targetName: currentState.player.name,
          turnNumber,
        })];
      }

      // Add debug event if debug mode enabled
      if (currentState.debugMode === true) {
        const debugEvent = createDamageDebugEvent(currentState.player.name, damageResult, 'dot');
        if (debugEvent !== null) {
          allEvents = [...allEvents, { ...debugEvent, turnNumber }];
        }
      }
    }
    if ('healPerTurn' in defaults) {
      const healAmount = (defaults as { healPerTurn: number }).healPerTurn;
      currentState = {
        ...currentState,
        player: {
          ...currentState.player,
          stats: {
            ...currentState.player.stats,
            health: Math.min(currentState.player.stats.maxHealth, currentState.player.stats.health + healAmount),
          },
        },
      };
    }
  }

  // Handle storm_active: strike 1-3 random visible enemies with shock + burn + stun
  const stormStatus = state.player.statuses.find(s => s.id === 'storm_active');
  if (stormStatus !== undefined && currentState.player.stats.health > 0 && currentState.run !== null && rng !== undefined) {
    const visibleEnemies = Array.from(currentState.run.enemies.values()).filter(enemy => {
      const key = posKey(enemy.position);
      const cell = currentState.run!.floor.cells.get(key);
      return cell !== undefined && cell.visibility === 'visible';
    });

    if (visibleEnemies.length > 0) {
      // Randomly select 1-3 targets
      const targetCount = Math.min(visibleEnemies.length, 1 + rng.int(0, 2)); // 1-3
      const shuffled = rng.shuffle(visibleEnemies);
      const targets = shuffled.slice(0, targetCount);

      // Strike each target with shock damage + burn + stun
      for (const enemy of targets) {
        const enemyKey = posKey(enemy.position);
        const baseDamage = 8; // Thunderstorm strike damage
        const damageResult = applyDamageToEnemy(currentState, enemy.id, {
          amount: baseDamage,
          damageType: 'shock',
          source: 'ability',
          bypassDefense: false,
          bypassResistance: false,
        });
        currentState = damageResult.state;

        allEvents = [...allEvents, {
          type: 'ABILITY_USED',
          playerId: currentState.player.id,
          abilityId: 'thunderstorm',
          abilityName: 'Thunderstorm Strike',
          targetId: enemy.id,
          targetName: enemy.name,
          damage: damageResult.finalDamage,
          timestamp: turnNumber,
          turnNumber,
          targetSnapshots: [{ targetId: enemy.id, position: { ...enemy.position } }],
        }];

        if (damageResult.killed === true) {
          const killResult = processEnemyKill(currentState, enemy, enemyKey, rng);
          currentState = killResult.state;
          allEvents = [...allEvents, ...killResult.events];
          continue;
        }

        // Apply burn (2 turns, magnitude 1)
        const burnedEnemy = currentState.run!.enemies.get(enemyKey);
        if (burnedEnemy !== undefined) {
          const withBurn = applyStatusToEnemy(burnedEnemy, 'burn', 2, 1, currentState.player.id);
          currentState = {
            ...currentState,
            run: {
              ...currentState.run!,
              enemies: new Map(currentState.run!.enemies).set(enemyKey, withBurn),
            },
          };
        }

        // Apply stun long enough to survive the end-of-round enemy status tick
        const stunnedEnemy = currentState.run!.enemies.get(enemyKey);
        if (stunnedEnemy !== undefined) {
          const withStun = applyStatusToEnemy(stunnedEnemy, 'stun', 2, 1, currentState.player.id);
          currentState = {
            ...currentState,
            run: {
              ...currentState.run!,
              enemies: new Map(currentState.run!.enemies).set(enemyKey, withStun),
            },
          };
        }
      }
    }
  }

  // Decrement durations, remove expired
  let remaining: StatusEffect[] = [];
  for (const status of state.player.statuses) {
    const newDuration = status.turnsRemaining - 1;
    if (newDuration <= 0) {
      allEvents = [...allEvents, {
        type: 'STATUS_EXPIRED',
        targetId: state.player.id,
        statusId: status.id,
        timestamp: turnNumber,
        turnNumber,
      }];
    } else {
      remaining = [...remaining, { ...status, turnsRemaining: newDuration }];
    }
  }

  return {
    state: {
      ...currentState,
      player: { ...currentState.player, statuses: remaining },
    },
    events: allEvents,
  };
}

/** Get effective stat value considering active statuses */
export function getEffectiveStat(
  baseStat: number,
  statName: string,
  statuses: readonly StatusEffect[],
): number {
  let value = baseStat;

  for (const status of statuses) {
    const defaults = STATUS_DEFAULTS[status.id];
    if (statName === 'attack' && status.id === 'strength') {
      // Strength buff adds its magnitude to attack (additive boost)
      value += status.magnitude;
    }
    if (statName === 'speed' && status.id === 'slow') {
      value = Math.round(value * (defaults as { speedMultiplier: number }).speedMultiplier);
    }
    if (statName === 'attack' && status.id === 'weaken') {
      value = Math.round(value * (defaults as { attackMultiplier: number }).attackMultiplier);
    }
    if (statName === 'defense' && status.id === 'vulnerability') {
      value = Math.round(value * (defaults as { defenseMultiplier: number }).defenseMultiplier);
    }
    // Future-proof: accuracy can be modified by status effects (currently none, but extensible)
    if (statName === 'accuracy') {
      if (status.id === 'panic') {
        value = Math.round(value * MAGIC.panicStatMultiplier);
      }
    }
    if (statName === 'evasion' && status.id === 'panic') {
      value = Math.round(value * MAGIC.panicStatMultiplier);
    }
  }

  return value;
}

/** Tick all status effects on an enemy, returning updated state + events */
export function tickEnemyStatuses(
  state: GameState,
  enemy: EnemyInstance,
  turnNumber: number,
): { state: GameState; events: DomainEvent[] } {
  let currentState = state;
  let allEvents: DomainEvent[] = [];

  // Cache initial statuses before any state updates
  const initialStatuses = enemy.statuses;

  // Apply damage from damaging statuses via central damage system
  for (const status of initialStatuses) {
    const defaults = STATUS_DEFAULTS[status.id];
    const damageAmount = getStatusDamageAmount(status);
    if (damageAmount !== null) {
      const damageType = statusToDamageType(status.id);
      // DoT only applies resistance, not defense
      const damageResult = applyDamageToEnemy(currentState, enemy.id, {
        amount: damageAmount,
        damageType: damageType ?? 'physical',
        source: 'dot',
        bypassDefense: true,
        bypassResistance: false,
      });
      currentState = damageResult.state;
      if (damageResult.finalDamage > 0) {
        allEvents = [...allEvents, createStatusDamageTickEvent({
          damage: damageResult.finalDamage,
          damageType: damageType ?? 'physical',
          statusId: status.id,
          targetId: enemy.id,
          targetName: enemy.name,
          turnNumber,
        })];
      }

      // Add debug event if debug mode enabled
      if (currentState.debugMode === true) {
        const debugEvent = createDamageDebugEvent(enemy.name, damageResult, 'dot');
        if (debugEvent !== null) {
          allEvents = [...allEvents, { ...debugEvent, turnNumber }];
        }
      }
    }
    if ('healPerTurn' in defaults) {
      const healAmount = (defaults as { healPerTurn: number }).healPerTurn;
      const enemyKey = posKey(enemy.position);
      const updatedEnemy = currentState.run?.enemies.get(enemyKey);
      if (updatedEnemy !== undefined) {
        const newEnemies = new Map(currentState.run!.enemies);
        newEnemies.set(enemyKey, {
          ...updatedEnemy,
          stats: {
            ...updatedEnemy.stats,
            health: Math.min(updatedEnemy.stats.maxHealth, updatedEnemy.stats.health + healAmount),
          },
        });
        currentState = { ...currentState, run: { ...currentState.run!, enemies: newEnemies } };
      }
    }
  }

  // Decrement durations, remove expired
  let remaining: StatusEffect[] = [];
  for (const status of initialStatuses) {
    const newDuration = status.turnsRemaining - 1;
    if (newDuration <= 0) {
      allEvents = [...allEvents, {
        type: 'STATUS_EXPIRED',
        targetId: enemy.id,
        statusId: status.id,
        timestamp: turnNumber,
        turnNumber,
      }];
    } else {
      remaining = [...remaining, { ...status, turnsRemaining: newDuration }];
    }
  }

  // Update the enemy's statuses in the state (enemies are keyed by position)
  const enemyKey = posKey(enemy.position);
  const finalEnemy = currentState.run?.enemies.get(enemyKey);
  if (finalEnemy !== undefined && currentState.run !== null) {
    const newEnemies = new Map(currentState.run.enemies);
    newEnemies.set(enemyKey, { ...finalEnemy, statuses: remaining });
    currentState = { ...currentState, run: { ...currentState.run, enemies: newEnemies } };
  }

  return {
    state: currentState,
    events: allEvents,
  };
}

/** Check if entity has a specific status */
export function hasStatus(statuses: readonly StatusEffect[], statusId: StatusId): boolean {
  return statuses.some(s => s.id === statusId);
}
