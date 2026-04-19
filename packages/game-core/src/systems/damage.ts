import type { GameState, DamageType, EnemyInstance, DomainEvent } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { applyDefense } from '../utils/dice.js';
import { COMBAT } from '@dungeon/content';

export type DamageSource = 'attack' | 'ability' | 'trap' | 'dot' | 'consumable' | 'thorns' | 'environment';

/** Create a debug damage calculation event if debug info is available */
export function createDamageDebugEvent(targetName: string, outcome: DamageOutcome, source: DamageSource): DomainEvent | null {
  const info = outcome.debugInfo;
  if (!info) return null;

  return {
    type: 'DEBUG_DAMAGE_CALC',
    targetName,
    source,
    rawDamage: info.rawAmount,
    finalDamage: outcome.finalDamage,
    defense: info.defense,
    resistance: info.resistance,
    bypassDefense: info.bypassDefense,
    bypassResistance: info.bypassResistance,
    timestamp: Date.now(),
    turnNumber: 0, // Will be set by caller if needed
  } as DomainEvent;
}

export interface DamageInput {
  readonly amount: number;
  readonly damageType: DamageType;
  readonly source: DamageSource;
  readonly sourceId?: string;
  readonly bypassDefense?: boolean;
  readonly bypassResistance?: boolean;
  readonly isCritical?: boolean;
}

export interface DamageOutcome {
  readonly state: GameState;
  readonly finalDamage: number;
  readonly killed: boolean;
  readonly debugInfo?: {
    readonly rawAmount: number;
    readonly defense: number;
    readonly resistance: number;
    readonly bypassDefense: boolean;
    readonly bypassResistance: boolean;
  };
}

/** Default bypass flags by source */
const DEFAULT_BYPASS_FLAGS: Record<DamageSource, { bypassDefense: boolean; bypassResistance: boolean }> = {
  attack: { bypassDefense: false, bypassResistance: false },
  ability: { bypassDefense: false, bypassResistance: false },
  trap: { bypassDefense: false, bypassResistance: false },
  consumable: { bypassDefense: false, bypassResistance: false },
  dot: { bypassDefense: true, bypassResistance: false },
  thorns: { bypassDefense: true, bypassResistance: true },
  environment: { bypassDefense: true, bypassResistance: true },
};

/** Debug logging level (set via environment variable) */
const DEBUG_DAMAGE = process.env.DEBUG_DAMAGE === 'true';

function log(message: string, data?: Record<string, unknown>): void {
  if (DEBUG_DAMAGE !== true) return;
  const timestamp = new Date().toISOString().split('T')[1];
  // eslint-disable-next-line no-console
  console.log(`[${timestamp}] [DAMAGE] ${message}`, data !== undefined ? JSON.stringify(data) : '');
}

/**
 * Apply damage to the player with defense and resistance mitigation.
 * Returns state with updated health and whether player was killed.
 * Handlers are responsible for emitting appropriate events.
 */
export function applyDamageToPlayer(state: GameState, input: DamageInput): DamageOutcome {
  log('applyDamageToPlayer start', {
    source: input.source,
    amount: input.amount,
    damageType: input.damageType,
    playerHealth: state.player.stats.health,
  });

  const defaults = DEFAULT_BYPASS_FLAGS[input.source];
  const bypassDefense = input.bypassDefense ?? defaults.bypassDefense;
  const bypassResistance = input.bypassResistance ?? defaults.bypassResistance;

  let damage = input.amount;
  const rawAmount = input.amount;
  let defense = 0;
  let resistance = 0;

  log('initial damage', { damage, bypassDefense, bypassResistance });

  // Apply defense
  if (bypassDefense !== true) {
    defense = state.player.stats.defense;
    damage = applyDefense(damage, defense, COMBAT.defenseDivisor);
    log('after defense', { defense, damage });
  }

  // Apply resistance
  if (bypassResistance !== true) {
    resistance = state.player.stats.resistances?.[input.damageType] ?? 0;
    const mitigated = damage * (1 - resistance);
    damage = Math.round(mitigated);
    log('after resistance', { resistance, mitigated, damage });
  }

  // Apply minimum damage clamp
  const finalDamage = Math.max(COMBAT.minDamage, damage);
  if (finalDamage !== damage) {
    log('clamped to minimum', { wasLower: damage, finalDamage });
  }

  // Apply damage to player
  const newHealth = state.player.stats.health - finalDamage;
  const killed = newHealth <= 0;

  log('final result', { finalDamage, newHealth, killed });

  const resultState = {
    ...state,
    player: {
      ...state.player,
      stats: {
        ...state.player.stats,
        health: Math.max(0, newHealth),
      },
    },
  };

  return {
    state: resultState,
    finalDamage,
    killed,
    debugInfo: {
      rawAmount,
      defense,
      resistance,
      bypassDefense,
      bypassResistance,
    },
  };
}

/** Find enemy by ID across all positions */
function findEnemyById(state: GameState, enemyId: string): EnemyInstance | undefined {
  if (state.run === null) return undefined;
  for (const enemy of state.run.enemies.values()) {
    if (enemy.id === enemyId) {
      return enemy;
    }
  }
  return undefined;
}

/**
 * Apply damage to a specific enemy with defense and resistance mitigation.
 * Returns state with updated enemy health and whether enemy was killed.
 * Handlers are responsible for emitting appropriate events.
 */
export function applyDamageToEnemy(state: GameState, enemyId: string, input: DamageInput): DamageOutcome {
  if (state.run === null) {
    return { state, finalDamage: 0, killed: false };
  }

  const targetEnemy = findEnemyById(state, enemyId);
  if (targetEnemy === undefined) {
    log('enemy not found', { enemyId });
    return { state, finalDamage: 0, killed: false };
  }

  log('applyDamageToEnemy start', {
    source: input.source,
    enemyId: targetEnemy.id,
    enemyName: targetEnemy.name,
    amount: input.amount,
    damageType: input.damageType,
    enemyHealth: targetEnemy.stats.health,
  });

  const defaults = DEFAULT_BYPASS_FLAGS[input.source];
  const bypassDefense = input.bypassDefense ?? defaults.bypassDefense;
  const bypassResistance = input.bypassResistance ?? defaults.bypassResistance;

  let damage = input.amount;
  const rawAmount = input.amount;
  let defense = 0;
  let resistance = 0;

  // Calculate damage with tracking for debug info
  damage = input.amount;
  if (bypassDefense !== true) {
    defense = targetEnemy.stats.defense;
    damage = applyDefense(damage, defense, COMBAT.defenseDivisor);
  }

  if (bypassResistance !== true) {
    resistance = targetEnemy.affinities[input.damageType] ?? 0;
    const mitigated = damage * (1 - resistance);
    damage = Math.round(mitigated);
  }

  const finalDamage = Math.max(COMBAT.minDamage, damage);

  const newHealth = targetEnemy.stats.health - finalDamage;
  const killed = newHealth <= 0;

  log('final result', { finalDamage, newHealth, killed });

  // Update enemy in state
  const key = posKey(targetEnemy.position);
  const newEnemies = new Map(state.run.enemies);

  if (killed === true) {
    newEnemies.delete(key);
  } else {
    const updatedEnemy: EnemyInstance = {
      ...targetEnemy,
      stats: {
        ...targetEnemy.stats,
        health: newHealth,
      },
    };
    newEnemies.set(key, updatedEnemy);
  }

  const resultState = {
    ...state,
    run: {
      ...state.run,
      enemies: newEnemies,
    },
  };

  return {
    state: resultState,
    finalDamage,
    killed,
    debugInfo: {
      rawAmount,
      defense,
      resistance,
      bypassDefense,
      bypassResistance,
    },
  };
}
