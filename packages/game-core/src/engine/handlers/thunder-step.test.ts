import { describe, it, expect } from 'vitest';
import { handleThunderStep } from './thunder-step.js';
import { createTestEnemy, createTestGameStateInCombat } from '../../test-utils.js';
import { posKey, entityId } from '@dungeon/contracts';
import type { AbilityUsedEvent, ItemTemplate } from '@dungeon/contracts';
import { SeededRNG } from '../../utils/rng.js';

const visibleFloorCell = {
  tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' },
  visibility: 'visible' as const,
};

const stationaryEnemyStats = {
  maxHealth: 30,
  health: 30,
  attack: 8,
  defense: 0,
  accuracy: 70,
  evasion: 15,
  speed: 0,
};

function createThunderStepState(targetVisibility: 'visible' | 'remembered' = 'visible') {
  const departureEnemy = createTestEnemy({
    position: { x: 0, y: 1 },
    stats: stationaryEnemyStats,
  });
  const arrivalEnemy = createTestEnemy({
    position: { x: 3, y: 0 },
    stats: stationaryEnemyStats,
  });

  const targetCell = targetVisibility === 'visible'
    ? visibleFloorCell
    : { ...visibleFloorCell, visibility: 'remembered' as const };

  const cells = new Map([
    ['0,0', visibleFloorCell],
    ['0,1', visibleFloorCell],
    ['1,0', visibleFloorCell],
    ['1,1', visibleFloorCell],
    ['2,0', targetCell],
    ['2,1', visibleFloorCell],
    ['3,0', visibleFloorCell],
  ]);

  const baseState = createTestGameStateInCombat();
  const lightningRingEntity = entityId('lightning_ring_1');
  const lightningRingTemplate: ItemTemplate = {
    itemId: 'lightning_ring',
    name: 'Lightning Ring',
    description: 'Lightning ring test fixture',
    itemClass: 'relic',
    rarity: 'common',
    value: 0,
    stackable: false,
    maxStack: 1,
  };
  return {
    ...baseState,
    player: {
      ...baseState.player,
      position: { x: 0, y: 0 },
      mana: 100,
      maxMana: 100,
      abilities: [{ id: 'thunder_step', cooldownRemaining: 0 }],
      learnedRingSpellIds: ['thunder_step'],
      ringMastery: {
        ...baseState.player.ringMastery,
        lightning: { xp: 200, lastLevelCheckpoint: 0 },
      },
      equipment: {
        ...baseState.player.equipment,
        ring1: lightningRingEntity,
      },
    },
    itemRegistry: {
      ...baseState.itemRegistry,
      items: new Map([
        ...baseState.itemRegistry.items,
        [lightningRingEntity, lightningRingTemplate],
      ]),
    },
    run: {
      ...baseState.run!,
      enemies: new Map([
        [posKey(departureEnemy.position), departureEnemy],
        [posKey(arrivalEnemy.position), arrivalEnemy],
      ]),
      floor: {
        ...baseState.run!.floor,
        cells,
      },
    },
  };
}

describe('handleThunderStep', () => {
  it('teleports player, damages both blast zones, and emits both strike positions', () => {
    const state = createThunderStepState();
    const result = handleThunderStep(
      state,
      { type: 'USE_ABILITY', abilityId: 'thunder_step', targetPosition: { x: 2, y: 0 } },
      new SeededRNG(12345),
    );

    expect(result.state.player.position).toEqual({ x: 2, y: 0 });
    expect(result.state.player.mana).toBeLessThan(state.player.mana);
    expect(result.state.player.abilities.find((ability) => ability.id === 'thunder_step')?.cooldownRemaining).toBeGreaterThan(0);

    const abilityEvent = result.events.find(
      (event): event is AbilityUsedEvent =>
        event.type === 'ABILITY_USED' && event.abilityId === 'thunder_step',
    );
    expect(abilityEvent?.targetSnapshots?.map((snapshot) => snapshot.position)).toEqual(
      expect.arrayContaining([{ x: 0, y: 0 }, { x: 2, y: 0 }]),
    );

    expect(result.state.run?.enemies.get('0,1')?.stats.health).toBeLessThan(30);
    expect(result.state.run?.enemies.get('3,0')?.stats.health).toBeLessThan(30);
  });

  it('recomputes visibility from the arrival tile after teleporting', () => {
    const baseState = createThunderStepState();
    const run = baseState.run;
    if (run === null) {
      throw new Error('Expected active run fixture');
    }

    const state = {
      ...baseState,
      run: {
        ...run,
        floor: {
          ...run.floor,
          cells: new Map(run.floor.cells).set('-8,0', visibleFloorCell),
        },
      },
    };

    const result = handleThunderStep(state, { type: 'USE_ABILITY', abilityId: 'thunder_step', targetPosition: { x: 2, y: 0 } }, new SeededRNG(12345));

    expect(result.state.run?.floor.cells.get('-8,0')?.visibility).toBe('remembered');
    expect(result.state.run?.floor.cells.get('2,0')?.visibility).toBe('visible');
  });

  it('routes lethal thunder_step hits through enemy kill processing', () => {
    const baseState = createThunderStepState();
    const run = baseState.run;
    if (run === null) {
      throw new Error('Expected active run fixture');
    }

    const departureEnemy = run.enemies.get('0,1');
    if (departureEnemy === undefined) {
      throw new Error('Expected departure enemy fixture');
    }

    const state = {
      ...baseState,
      run: {
        ...run,
        enemies: new Map(run.enemies).set('0,1', {
          ...departureEnemy,
          stats: {
            ...departureEnemy.stats,
            health: 1,
          },
        }),
      },
    };

    const result = handleThunderStep(state, { type: 'USE_ABILITY', abilityId: 'thunder_step', targetPosition: { x: 2, y: 0 } }, new SeededRNG(12345));

    expect(result.state.run?.enemies.get('0,1')).toBeUndefined();
    expect(result.state.player.totalKills).toBe(state.player.totalKills + 1);
    expect(result.state.player.experience).toBe(state.player.experience + departureEnemy.experienceValue);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ENTITY_DIED',
      entityId: departureEnemy.id,
      killerId: state.player.id,
    }));
  });

  it('rejects remembered-but-not-visible targets with TILE_NOT_VISIBLE', () => {
    const state = createThunderStepState('remembered');
    const result = handleThunderStep(state, { type: 'USE_ABILITY', abilityId: 'thunder_step', targetPosition: { x: 2, y: 0 } }, new SeededRNG(12345));

    expect(result.state.player.position).toEqual({ x: 0, y: 0 });
    expect(result.events.length).toBeGreaterThan(0);
    const rejectionEvent = result.events.find(
      (event): event is any =>
        typeof event === 'object' && event !== null && 'type' in event && event.type === 'PLAYER_ACTION_REJECTED',
    );
    expect(rejectionEvent).toBeDefined();
    expect(rejectionEvent?.reasonCode).toBe('TILE_NOT_VISIBLE');
  });

  it('rejects unwalkable target tiles with INVALID_TILE_TARGET', () => {
    const baseState = createThunderStepState();
    const run = baseState.run;
    if (run === null) {
      throw new Error('Expected active run fixture');
    }

    const state = {
      ...baseState,
      run: {
        ...run,
        floor: {
          ...run.floor,
          cells: new Map(run.floor.cells).set('2,0', {
            ...visibleFloorCell,
            tile: {
              ...visibleFloorCell.tile,
              walkable: false,
            },
          }),
        },
      },
    };

    const result = handleThunderStep(state, { type: 'USE_ABILITY', abilityId: 'thunder_step', targetPosition: { x: 2, y: 0 } }, new SeededRNG(12345));

    expect(result.state).toBe(state);
    expect(result.events.length).toBeGreaterThan(0);
    const rejectionEvent = result.events.find(
      (event): event is any =>
        typeof event === 'object' && event !== null && 'type' in event && event.type === 'PLAYER_ACTION_REJECTED',
    );
    expect(rejectionEvent).toBeDefined();
    expect(rejectionEvent?.reasonCode).toBe('INVALID_TILE_TARGET');
  });

  it('rejects occupied target tiles with TILE_OCCUPIED', () => {
    const baseState = createThunderStepState();
    const run = baseState.run;
    if (run === null) {
      throw new Error('Expected active run fixture');
    }

    const blockingEnemy = createTestEnemy({
      position: { x: 2, y: 0 },
      stats: stationaryEnemyStats,
    });
    const state = {
      ...baseState,
      run: {
        ...run,
        enemies: new Map(run.enemies).set(posKey(blockingEnemy.position), blockingEnemy),
      },
    };

    const result = handleThunderStep(state, { type: 'USE_ABILITY', abilityId: 'thunder_step', targetPosition: { x: 2, y: 0 } }, new SeededRNG(12345));

    expect(result.state).toBe(state);
    expect(result.events.length).toBeGreaterThan(0);
    const rejectionEvent = result.events.find(
      (event): event is any =>
        typeof event === 'object' && event !== null && 'type' in event && event.type === 'PLAYER_ACTION_REJECTED',
    );
    expect(rejectionEvent).toBeDefined();
    expect(rejectionEvent?.reasonCode).toBe('TILE_OCCUPIED');
  });

  it('rejects casts without enough mana before moving or dealing damage', () => {
    const baseState = createThunderStepState();
    const state = {
      ...baseState,
      player: {
        ...baseState.player,
        mana: 11,
      },
    };
    const departureEnemyHealth = state.run?.enemies.get('0,1')?.stats.health;
    const arrivalEnemyHealth = state.run?.enemies.get('3,0')?.stats.health;

    const result = handleThunderStep(state, { type: 'USE_ABILITY', abilityId: 'thunder_step', targetPosition: { x: 2, y: 0 } }, new SeededRNG(12345));

    expect(result.state).toBe(state);
    expect(result.state.player.position).toEqual(state.player.position);
    expect(result.state.player.mana).toBe(state.player.mana);
    expect(result.state.turnNumber).toBe(state.turnNumber);
    expect(result.state.run?.enemies.get('0,1')?.stats.health).toBe(departureEnemyHealth);
    expect(result.state.run?.enemies.get('3,0')?.stats.health).toBe(arrivalEnemyHealth);
    expect(result.events.length).toBeGreaterThan(0);
    const rejectionEvent = result.events.find(
      (event): event is any =>
        typeof event === 'object' && event !== null && 'type' in event && event.type === 'PLAYER_ACTION_REJECTED',
    );
    expect(rejectionEvent).toBeDefined();
    expect(rejectionEvent?.reasonCode).toBe('INSUFFICIENT_MANA');
  });

  it('rejects casts while thunder_step is on cooldown', () => {
    const baseState = createThunderStepState();
    const state = {
      ...baseState,
      player: {
        ...baseState.player,
        abilities: [{ id: 'thunder_step', cooldownRemaining: 1 }],
      },
    };
    const departureEnemyHealth = state.run?.enemies.get('0,1')?.stats.health;
    const arrivalEnemyHealth = state.run?.enemies.get('3,0')?.stats.health;

    const result = handleThunderStep(state, { type: 'USE_ABILITY', abilityId: 'thunder_step', targetPosition: { x: 2, y: 0 } }, new SeededRNG(12345));

    expect(result.state).toBe(state);
    expect(result.state.player.position).toEqual(state.player.position);
    expect(result.state.player.mana).toBe(state.player.mana);
    expect(result.state.turnNumber).toBe(state.turnNumber);
    expect(result.state.run?.enemies.get('0,1')?.stats.health).toBe(departureEnemyHealth);
    expect(result.state.run?.enemies.get('3,0')?.stats.health).toBe(arrivalEnemyHealth);
    expect(result.events.length).toBeGreaterThan(0);
    const rejectionEvent = result.events.find(
      (event): event is any =>
        typeof event === 'object' && event !== null && 'type' in event && event.type === 'PLAYER_ACTION_REJECTED',
    );
    expect(rejectionEvent).toBeDefined();
    expect(rejectionEvent?.reasonCode).toBe('ABILITY_ON_COOLDOWN');
  });

  it('rejects the player current tile without spending mana or hitting either blast zone', () => {
    const state = createThunderStepState();
    const departureEnemyHealth = state.run?.enemies.get('0,1')?.stats.health;
    const arrivalEnemyHealth = state.run?.enemies.get('3,0')?.stats.health;

    const result = handleThunderStep(state, { type: 'USE_ABILITY', abilityId: 'thunder_step', targetPosition: { x: 0, y: 0 } }, new SeededRNG(12345));

    expect(result.state.player.position).toEqual(state.player.position);
    expect(result.state.player.mana).toBe(state.player.mana);
    expect(result.state.turnNumber).toBe(state.turnNumber);
    expect(result.state.run?.enemies.get('0,1')?.stats.health).toBe(departureEnemyHealth);
    expect(result.state.run?.enemies.get('3,0')?.stats.health).toBe(arrivalEnemyHealth);
    expect(result.events.length).toBeGreaterThan(0);
    const rejectionEvent = result.events.find(
      (event): event is any =>
        typeof event === 'object' && event !== null && 'type' in event && event.type === 'PLAYER_ACTION_REJECTED',
    );
    expect(rejectionEvent).toBeDefined();
    expect(rejectionEvent?.reasonCode).toBe('INVALID_TILE_TARGET');
  });
});
