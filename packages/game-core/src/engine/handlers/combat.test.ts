import { describe, it, expect } from 'vitest';
import { handleAttack } from './combat.js';
import { processEnemyKill } from '../enemy-death-pipeline.js';
import { createTestGameStateInCombat } from '../../test-utils.js';
import { SeededRNG } from '../../utils/rng.js';
import { getFireBurnDuration, getFireBurnMagnitude, getFireMasteryLevel } from '../../systems/magic-xp.js';
import { entityId } from '@dungeon/contracts';
import type { AnyItemTemplate, DomainEvent, EntityId, GameState, WeaponTemplate } from '@dungeon/contracts';

function makeLethalAttackState(equippedWeaponId = 'rusty_sword'): {
  readonly state: GameState;
  readonly enemyId: ReturnType<typeof entityId>;
  readonly enemyKey: string;
  readonly enemyPosition: { readonly x: number; readonly y: number };
} {
  const baseState = createTestGameStateInCombat({ equippedWeaponId });
  const [enemyKey, enemy] = [...baseState.run!.enemies.entries()][0]!;
  const weakEnemy = {
    ...enemy,
    stats: {
      ...enemy.stats,
      maxHealth: 1,
      health: 1,
      defense: 0,
      evasion: 0,
    },
  };
  const state: GameState = {
    ...baseState,
    player: {
      ...baseState.player,
      stats: {
        ...baseState.player.stats,
        attack: 999,
        accuracy: 999,
      },
    },
    run: {
      ...baseState.run!,
      enemies: new Map([[enemyKey, weakEnemy]]),
    },
  };

  return { state, enemyId: weakEnemy.id, enemyKey, enemyPosition: weakEnemy.position };
}

function makeGuaranteedStatusWeaponState(): {
  readonly state: GameState;
  readonly enemyId: ReturnType<typeof entityId>;
} {
  const weaponId = entityId('guaranteed_status_blade');
  const baseState = makeLethalAttackState('rusty_sword').state;
  const maybeWeapon = baseState.itemRegistry.items.get(entityId('rusty_sword'));
  if (maybeWeapon === undefined || maybeWeapon.itemClass !== 'weapon' || !('weapon' in maybeWeapon)) {
    throw new Error('Expected rusty_sword weapon template');
  }
  const baseWeapon: WeaponTemplate = maybeWeapon;
  const statusWeapon: WeaponTemplate = {
    ...baseWeapon,
    weapon: {
      ...baseWeapon.weapon,
      onHitStatus: 'burn',
      onHitChance: 100,
    },
  };
  const itemRegistry: GameState['itemRegistry'] = {
    items: new Map<EntityId, AnyItemTemplate>([
      ...baseState.itemRegistry.items,
      [weaponId, statusWeapon],
    ]),
  };
  const [enemy] = [...baseState.run!.enemies.values()];
  if (enemy === undefined) throw new Error('Expected enemy');

  return {
    state: {
      ...baseState,
      itemRegistry,
      player: {
        ...baseState.player,
        equipment: {
          ...baseState.player.equipment,
          weapon: weaponId,
        },
      },
    },
    enemyId: enemy.id,
  };
}

describe('handleAttack integration', () => {
  it('rejects attacks against a missing target', () => {
    const state = createTestGameStateInCombat();

    const result = handleAttack(state, entityId('missing_target'), new SeededRNG(1000));

    expect(result.state).toBe(state);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'PLAYER_ACTION_REJECTED',
      reasonCode: 'TARGET_NOT_FOUND',
    }));
  });

  it('should pass weapon damage profile to combat resolver', () => {
    const state = createTestGameStateInCombat();

    // Game state should have enemies to attack
    if (!state.run || state.run.enemies.size === 0) {
      throw new Error('Test state must have active run with enemies');
    }

    // Get first enemy
    const entryResult = state.run.enemies.entries().next();
    if (entryResult.done || !entryResult.value) {
      throw new Error('No enemies found');
    }
    const [, enemy] = entryResult.value;

    // Run attack multiple times and collect damage results
    const damages: number[] = [];
    for (let i = 0; i < 20; i++) {
      const result = handleAttack({ ...state }, enemy.id, new SeededRNG(i + 1000));

      if (result.events.length > 0) {
        const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
        if (attackEvent && 'damage' in attackEvent) {
          damages.push(attackEvent.damage);
        }
      }
    }

    // With weapon profile passing:
    // - Player has attack stat (likely 11-15)
    // - Equipped weapon has damage (likely 5-9 range)
    // - Total should be around 16-24 range
    // Without weapon profile (old broken code):
    // - Would roll with 0.15 variance on attack stat only
    // - Much narrower range

    const minDamage = Math.min(...damages.filter(d => d > 0));
    const maxDamage = Math.max(...damages);

    // Verify we get a reasonable range (indicates weapon profile is being used)
    // With weapon profile: damage should vary (attack + weapon range variation)
    // Without weapon profile: would be much narrower (just attack variance)
    // Note: defense mitigation affects final damage, but we should still see variation
    expect(damages.length).toBeGreaterThan(0);
    expect(maxDamage - minDamage).toBeGreaterThanOrEqual(3);
  });

  it('emits ATTACK_PERFORMED before ENTITY_DIED with matching target snapshot', () => {
    const { state, enemyId, enemyKey, enemyPosition } = makeLethalAttackState();

    const result = handleAttack(state, enemyId, new SeededRNG(1));
    const attackIndex = result.events.findIndex(event => event.type === 'ATTACK_PERFORMED');
    const deathIndex = result.events.findIndex(event => event.type === 'ENTITY_DIED');
    const attackEvent = result.events.find(
      (event): event is Extract<DomainEvent, { type: 'ATTACK_PERFORMED' }> => event.type === 'ATTACK_PERFORMED',
    );
    const deathEvent = result.events.find(
      (event): event is Extract<DomainEvent, { type: 'ENTITY_DIED' }> => event.type === 'ENTITY_DIED',
    );

    expect(attackIndex).toBeGreaterThanOrEqual(0);
    expect(deathIndex).toBeGreaterThan(attackIndex);
    expect(attackEvent).toMatchObject({
      defenderId: enemyId,
      defenderPosition: enemyPosition,
      position: enemyPosition,
      preHealth: 1,
      postHealth: 0,
      killed: true,
      causeType: 'attack',
    });
    expect(deathEvent).toMatchObject({
      entityId: enemyId,
      entityPosition: enemyPosition,
      entityMapKey: enemyKey,
      causeType: 'attack',
      causeId: attackEvent?.causeId,
      sourceEventType: 'ATTACK_PERFORMED',
    });
    expect(result.state.run?.enemies.has(enemyKey)).toBe(false);
  });

  it('shared enemy death finalization runs only once for the same enemy', () => {
    const state = createTestGameStateInCombat();
    const [enemyKey, enemy] = [...state.run!.enemies.entries()][0]!;
    const deadEnemy = {
      ...enemy,
      stats: {
        ...enemy.stats,
        health: 0,
      },
    };
    const stateWithDeadEnemy: GameState = {
      ...state,
      run: {
        ...state.run!,
        enemies: new Map([[enemyKey, deadEnemy]]),
      },
    };

    const first = processEnemyKill(stateWithDeadEnemy, deadEnemy, enemyKey, new SeededRNG(1), {
      causeType: 'attack',
      causeId: 'attack:test',
      killerId: state.player.id,
      killerName: state.player.name,
      sourceEventType: 'ATTACK_PERFORMED',
      turnNumber: state.turnNumber,
    });
    const second = processEnemyKill(first.state, deadEnemy, enemyKey, new SeededRNG(1), {
      causeType: 'attack',
      causeId: 'attack:test',
      killerId: state.player.id,
      killerName: state.player.name,
      sourceEventType: 'ATTACK_PERFORMED',
      turnNumber: state.turnNumber,
    });
    const events: DomainEvent[] = [...first.events, ...second.events];

    expect(events.filter(event => event.type === 'ENTITY_DIED')).toHaveLength(1);
    expect(first.state.run?.enemies.has(enemyKey)).toBe(false);
    expect(second.events).toHaveLength(0);
    expect(second.state.player.totalKills).toBe(state.player.totalKills + 1);
    expect(second.state.player.experience).toBeGreaterThan(state.player.experience);
  });

  it('applies weapon on-hit burn with the same fire-mastery duration/magnitude as the ability path', () => {
    const makeSurvivableBurnWeaponState = (fireXp: number): {
      readonly state: GameState;
      readonly enemyId: EntityId;
    } => {
      const { state: armed } = makeGuaranteedStatusWeaponState();
      const [enemyKey, enemy] = [...armed.run!.enemies.entries()][0]!;
      const tankyEnemy = {
        ...enemy,
        stats: { ...enemy.stats, maxHealth: 1000, health: 1000, defense: 0, evasion: 0 },
      };
      return {
        state: {
          ...armed,
          player: {
            ...armed.player,
            stats: { ...armed.player.stats, attack: 5, accuracy: 999 },
            ringMastery: fireXp > 0 ? { fire: { xp: fireXp } } : {},
          },
          run: { ...armed.run!, enemies: new Map([[enemyKey, tankyEnemy]]) },
        },
        enemyId: tankyEnemy.id,
      };
    };
    const findBurnEvent = (events: readonly DomainEvent[], targetId: EntityId) => events.find(
      (event): event is Extract<DomainEvent, { type: 'STATUS_APPLIED' }> =>
        event.type === 'STATUS_APPLIED' && event.targetId === targetId,
    );

    const baseline = makeSurvivableBurnWeaponState(0);
    const baselineResult = handleAttack(baseline.state, baseline.enemyId, new SeededRNG(7));
    const baselineBurn = findBurnEvent(baselineResult.events, baseline.enemyId);
    expect(baselineBurn).toBeDefined();

    const mastered = makeSurvivableBurnWeaponState(999_999);
    expect(getFireMasteryLevel(mastered.state.player)).toBeGreaterThan(0);
    const expectedDuration = getFireBurnDuration(mastered.state.player, baselineBurn!.duration);
    const expectedMagnitude = getFireBurnMagnitude(mastered.state.player);
    expect(expectedDuration).not.toBe(baselineBurn!.duration);

    const masteredResult = handleAttack(mastered.state, mastered.enemyId, new SeededRNG(7));
    const masteredBurn = findBurnEvent(masteredResult.events, mastered.enemyId);
    expect(masteredBurn?.duration).toBe(expectedDuration);

    const enemyAfter = [...(masteredResult.state.run?.enemies.values() ?? [])]
      .find(candidate => candidate.id === mastered.enemyId);
    const appliedBurn = enemyAfter?.statuses.find(status => status.id === baselineBurn!.statusId);
    expect(appliedBurn?.magnitude).toBe(expectedMagnitude);
  });

  it('does not apply on-hit statuses after lethal attack damage', () => {
    const { state, enemyId } = makeGuaranteedStatusWeaponState();

    const result = handleAttack(state, enemyId, new SeededRNG(1));

    expect(result.events.some(event =>
      event.type === 'STATUS_APPLIED' && event.targetId === enemyId
    )).toBe(false);
    expect(result.events.some(event =>
      event.type === 'ENTITY_DIED' && event.entityId === enemyId
    )).toBe(true);
  });
});
