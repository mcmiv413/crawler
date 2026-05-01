import type { GameState, EnemyInstance, DomainEvent, DamageType, StatusId, CombatContext } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { type SeededRNG } from '../utils/rng.js';
import { resolveAttack } from './combat.js';
import { applyStatusToPlayer, getEffectiveStat } from './status-effects.js';
import { handlePlayerDeath } from './death.js';
import { applyBlinkOnHit } from './enchantment-hooks.js';

/** Ability definition for an enemy */
export interface EnemyAbilityDef {
  readonly id: string;
  readonly name: string;
  readonly damageMultiplier?: number; // Base damage multiplier (default 1x)
  readonly damageType?: DamageType; // Override default damage type
  readonly range?: number; // Melee = 1, Ranged = 2+
  readonly cooldown: number; // Turns between uses
  readonly description: string;
  readonly statusId?: StatusId; // Optional status to apply
  readonly statusDuration?: number; // Duration for status
  readonly statusMagnitude?: number; // Magnitude for status
  readonly targetSelf?: boolean; // If true, apply status to caster, not player
}

/** Ability definitions for all enemy types */
export const ENEMY_ABILITY_DEFINITIONS = new Map<string, EnemyAbilityDef>([
  [
    'crushing_blow',
    {
      id: 'crushing_blow',
      name: 'Crushing Blow',
      damageMultiplier: 2.0,
      range: 1,
      cooldown: 3,
      description: 'A powerful melee strike dealing double damage.',
    },
  ],
  [
    'fire_bolt',
    {
      id: 'fire_bolt',
      name: 'Fire Bolt',
      damageMultiplier: 1.5,
      damageType: 'fire' as DamageType,
      range: 3,
      cooldown: 2,
      description: 'A ranged fire projectile.',
    },
  ],
  [
    'flame_trail',
    {
      id: 'flame_trail',
      name: 'Flame Trail',
      damageMultiplier: 1.2,
      damageType: 'fire' as DamageType,
      range: 1,
      cooldown: 2,
      statusId: 'burn',
      statusDuration: 2,
      statusMagnitude: 1,
      description: 'A melee attack that leaves a burning trail.',
    },
  ],
  [
    'frost_bolt',
    {
      id: 'frost_bolt',
      name: 'Frost Bolt',
      damageMultiplier: 1.2,
      damageType: 'shock' as DamageType,
      range: 3,
      cooldown: 2,
      statusId: 'slow',
      statusDuration: 2,
      statusMagnitude: 1,
      description: 'A chilling ranged attack that slows the target.',
    },
  ],
  [
    'roar',
    {
      id: 'roar',
      name: 'Roar',
      damageMultiplier: 0,
      range: 1,
      cooldown: 5,
      statusId: 'strength',
      statusDuration: 3,
      statusMagnitude: 1,
      targetSelf: true,
      description: 'A powerful roar that strengthens the caster.',
    },
  ],
  [
    'chilling_aura',
    {
      id: 'chilling_aura',
      name: 'Chilling Aura',
      damageMultiplier: 0,
      range: 3,
      cooldown: 4,
      statusId: 'slow',
      statusDuration: 3,
      statusMagnitude: 1,
      description: 'An aura that chills nearby enemies, slowing their movements.',
    },
  ],
]);

/**
 * Resolve the effects of an enemy using an ability.
 */
/**
 * Resolve the effects of an enemy using an ability.
 */
export function resolveEnemyAbility(
  abilityId: string,
  enemy: EnemyInstance,
  state: GameState,
  rng: SeededRNG,
): { state: GameState; events: DomainEvent[] } {
  if (state.run === null) return { state, events: [] };

  const abilityDef = ENEMY_ABILITY_DEFINITIONS.get(abilityId);
  if (abilityDef === undefined) return { state, events: [] };

  let events: DomainEvent[] = [];

  // Set ability cooldown after use
  let updatedEnemy = { ...enemy };
  if (updatedEnemy.abilityCooldowns === undefined) {
    updatedEnemy = { ...updatedEnemy, abilityCooldowns: {} };
  }
  updatedEnemy = {
    ...updatedEnemy,
    abilityCooldowns: {
      ...updatedEnemy.abilityCooldowns,
      [abilityId]: abilityDef.cooldown,
    },
  };

  // Update enemy in state with cooldown set
  const newEnemies = new Map(state.run.enemies);
  newEnemies.delete(posKey(enemy.position));
  newEnemies.set(posKey(updatedEnemy.position), updatedEnemy);
  let newState = {
    ...state,
    run: {
      ...state.run,
      runId: state.run.runId,
      floor: state.run.floor,
      enemies: newEnemies,
      objects: state.run.objects,
      turnCount: state.run.turnCount,
      isActive: state.run.isActive,
      runMetrics: state.run.runMetrics,
      floorHistory: state.run.floorHistory,
      floorCache: state.run.floorCache,
      weaponMastery: state.weaponMastery,
      speedAccumulators: state.run.speedAccumulators,
    },
  };

  // A8: If ability deals damage, resolve an attack
  if (abilityDef.damageMultiplier !== undefined && abilityDef.damageMultiplier > 0) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const damageType = abilityDef.damageType !== undefined ? abilityDef.damageType : (enemy.equipment?.weapon?.damageType ?? 'physical');
    const effectiveAttack = getEffectiveStat(enemy.stats.attack, 'attack', enemy.statuses);
    const effectiveAccuracy = getEffectiveStat(enemy.stats.accuracy, 'accuracy', enemy.statuses);
    const playerDefense = getEffectiveStat(state.player.stats.defense, 'defense', state.player.statuses);
    const playerEvasion = state.player.stats.evasion;
    const playerResistance = state.player.stats.resistances?.[damageType] ?? 0;

    // A8: Check blink before resolving damage (blink guarantees miss)
    const blinked = applyBlinkOnHit(newState, () => rng.next());

    const ctx: CombatContext = {
      attackerId: enemy.id,
      defenderId: state.player.id,
      attackerAttack: effectiveAttack * (abilityDef.damageMultiplier ?? 1),
      attackerAccuracy: effectiveAccuracy,
      defenderDefense: playerDefense,
      defenderEvasion: blinked === true ? 100 : playerEvasion,
      defenderHealth: state.player.stats.health,
      damageType,
      defenderResistance: playerResistance,
    };

    const result = resolveAttack(ctx, rng);

    events = [...events, {
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
      timestamp: state.turnNumber,
      turnNumber: state.turnNumber,
    }];

    if (result.hit === true) {
      const newHealth = Math.max(0, newState.player.stats.health - result.damage);
      newState = {
        ...newState,
        player: {
          ...newState.player,
          stats: { ...newState.player.stats, health: newHealth },
        },
      };
      // Note: updateRunMetrics call moved to engine layer (turn-scheduler or command-handler)
      // to avoid inverted dependency (systems should not import from engine)

      if (newHealth <= 0) {
        const deathResult = handlePlayerDeath(newState, enemy.id, `Killed by ${enemy.name}`, rng, state.player.stats.health - newHealth);
        return {
          state: deathResult.state,
          events: [...events, ...deathResult.events],
        };
      }
    }
  }

  // Apply status effect if ability has one
  if (abilityDef.statusId !== undefined && abilityDef.statusDuration !== undefined && abilityDef.statusMagnitude !== undefined) {
    if (abilityDef.targetSelf === true) {
      // Apply status to the caster (enemy), not the player
      const enemyWithStatus = {
        ...updatedEnemy,
        statuses: [
          ...updatedEnemy.statuses,
          {
            id: abilityDef.statusId,
            turnsRemaining: abilityDef.statusDuration,
            magnitude: abilityDef.statusMagnitude,
            sourceId: enemy.id,
          },
        ],
      };

      // Update the enemies map with the enemy that now has the status
      const enemiesWithStatus = new Map(newState.run!.enemies);
      enemiesWithStatus.delete(posKey(updatedEnemy.position));
      enemiesWithStatus.set(posKey(enemyWithStatus.position), enemyWithStatus);

      newState = {
        ...newState,
        run: { ...newState.run!, enemies: enemiesWithStatus },
      };

      events = [...events, {
        type: 'STATUS_APPLIED',
        targetId: enemy.id,
        statusId: abilityDef.statusId,
        duration: abilityDef.statusDuration,
        sourceId: enemy.id,
        timestamp: state.turnNumber,
        turnNumber: state.turnNumber,
      }];
    } else {
      // Apply status to the player (default behavior)
      const updatedPlayer = applyStatusToPlayer(
        newState.player,
        abilityDef.statusId,
        abilityDef.statusDuration,
        abilityDef.statusMagnitude,
        enemy.id,
      );

      newState = { ...newState, player: updatedPlayer };

      events = [...events, {
        type: 'STATUS_APPLIED',
        targetId: state.player.id,
        statusId: abilityDef.statusId,
        duration: abilityDef.statusDuration,
        sourceId: enemy.id,
        timestamp: state.turnNumber,
        turnNumber: state.turnNumber,
      }];
    }
  }

  return { state: newState, events };
}
