import type { Player, EnemyInstance, EntityId, StatusId } from '@dungeon/contracts';
import type { StatusEffect } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { STATUS_DEFAULTS } from '@dungeon/content';

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
  player: Player,
  turnNumber: number,
): { player: Player; events: DomainEvent[] } {
  let events: DomainEvent[] = [];
  let currentHealth = player.stats.health;

  for (const status of player.statuses) {
    const defaults = STATUS_DEFAULTS[status.id];
    if ('damagePerTurn' in defaults) {
      currentHealth -= (defaults as { damagePerTurn: number }).damagePerTurn;
    }
    if ('healPerTurn' in defaults) {
      currentHealth = Math.min(
        player.stats.maxHealth,
        currentHealth + (defaults as { healPerTurn: number }).healPerTurn,
      );
    }
  }

  // Decrement durations, remove expired
  let remaining: StatusEffect[] = [];
  for (const status of player.statuses) {
    const newDuration = status.turnsRemaining - 1;
    if (newDuration <= 0) {
      // Status effects now handled via getEffectiveStat; no manual undo needed
      events = [...events, {
        type: 'STATUS_EXPIRED',
        targetId: player.id,
        statusId: status.id,
        timestamp: Date.now(),
        turnNumber,
      }];
    } else {
      remaining = [...remaining, { ...status, turnsRemaining: newDuration }];
    }
  }

  return {
    player: {
      ...player,
      stats: { ...player.stats, health: Math.max(0, currentHealth) },
      statuses: remaining,
    },
    events,
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
      // Placeholder for accuracy-modifying statuses
    }
  }

  return value;
}

/** Tick all status effects on an enemy, returning updated enemy + events */
export function tickEnemyStatuses(
  enemy: EnemyInstance,
  turnNumber: number,
): { enemy: EnemyInstance; events: DomainEvent[] } {
  let events: DomainEvent[] = [];
  let currentHealth = enemy.stats.health;

  for (const status of enemy.statuses) {
    const defaults = STATUS_DEFAULTS[status.id];
    if ('damagePerTurn' in defaults) {
      currentHealth -= (defaults as { damagePerTurn: number }).damagePerTurn;
    }
    if ('healPerTurn' in defaults) {
      currentHealth = Math.min(
        enemy.stats.maxHealth,
        currentHealth + (defaults as { healPerTurn: number }).healPerTurn,
      );
    }
  }

  // Decrement durations, remove expired
  let remaining: StatusEffect[] = [];
  for (const status of enemy.statuses) {
    const newDuration = status.turnsRemaining - 1;
    if (newDuration <= 0) {
      events = [...events, {
        type: 'STATUS_EXPIRED',
        targetId: enemy.id,
        statusId: status.id,
        timestamp: Date.now(),
        turnNumber,
      }];
    } else {
      remaining = [...remaining, { ...status, turnsRemaining: newDuration }];
    }
  }

  return {
    enemy: {
      ...enemy,
      stats: { ...enemy.stats, health: Math.max(0, currentHealth) },
      statuses: remaining,
    },
    events,
  };
}

/** Check if entity has a specific status */
export function hasStatus(statuses: readonly StatusEffect[], statusId: StatusId): boolean {
  return statuses.some(s => s.id === statusId);
}
