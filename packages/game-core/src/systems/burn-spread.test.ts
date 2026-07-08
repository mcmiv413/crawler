/**
 * Test layer: unit
 * Behavior: spreadBurnFromDeadEnemy spreads burn and high-mastery panic from a burning dead enemy to nearby living enemies while leaving non-burning deaths unchanged.
 * Proof: Asserts nearby enemy statuses gain burn or panic, far enemies do not, STATUS_APPLIED events target the affected enemy/status, and non-burning input returns the original enemy map with no events.
 * Validation: pnpm vitest run packages/game-core/src/systems/burn-spread.test.ts
 */
import { describe, it, expect } from 'vitest';
import { entityId, posKey } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
import { createTestEnemy, createTestGameState, createTestRunState } from '../test-utils.js';
import { spreadBurnFromDeadEnemy } from './burn-spread.js';

const alwaysSpreadRng = {
  chance: () => true,
} as unknown as SeededRNG;

describe('spreadBurnFromDeadEnemy', () => {
  it('spreads burn from a burned dead enemy to nearby living enemies only', () => {
    const deadEnemy = createTestEnemy({
      id: entityId('dead_enemy'),
      position: { x: 0, y: 1 },
      statuses: [{ id: 'burn', turnsRemaining: 2, magnitude: 1, sourceId: null }],
    });
    const nearbyEnemy = createTestEnemy({
      position: { x: 1, y: 1 },
      statuses: [],
    });
    const farEnemy = createTestEnemy({
      position: { x: 9, y: 9 },
      statuses: [],
    });
    const run = createTestRunState({
      enemies: new Map([
        [posKey(nearbyEnemy.position), nearbyEnemy],
        [posKey(farEnemy.position), farEnemy],
      ]),
    });
    const state = { ...createTestGameState({ phase: 'dungeon' }), run };

    const result = spreadBurnFromDeadEnemy(state, deadEnemy, alwaysSpreadRng);

    const updatedNearby = result.enemies.get(posKey(nearbyEnemy.position));
    const updatedFar = result.enemies.get(posKey(farEnemy.position));
    expect(updatedNearby?.statuses.some(status => status.id === 'burn')).toBe(true);
    expect(updatedFar?.statuses.some(status => status.id === 'burn')).toBe(false);
    expect(result.events.some(event => event.type === 'STATUS_APPLIED' && event.targetId === nearbyEnemy.id)).toBe(true);
    expect(result.events.some(event => event.type === 'STATUS_APPLIED' && event.targetId === farEnemy.id)).toBe(false);
  });

  it('does not spread when the dead enemy was not burning', () => {
    const deadEnemy = createTestEnemy({
      position: { x: 0, y: 1 },
      statuses: [],
    });
    const nearbyEnemy = createTestEnemy({
      position: { x: 1, y: 1 },
      statuses: [],
    });
    const run = createTestRunState({
      enemies: new Map([[posKey(nearbyEnemy.position), nearbyEnemy]]),
    });
    const state = { ...createTestGameState({ phase: 'dungeon' }), run };

    const result = spreadBurnFromDeadEnemy(state, deadEnemy, alwaysSpreadRng);

    expect(result.enemies).toBe(state.run?.enemies);
    expect(result.events).toHaveLength(0);
  });

  it('can add panic during high-mastery burn spread', () => {
    const deadEnemy = createTestEnemy({
      id: entityId('dead_enemy_mastered'),
      position: { x: 0, y: 1 },
      statuses: [{ id: 'burn', turnsRemaining: 2, magnitude: 1, sourceId: null }],
    });
    const nearbyEnemy = createTestEnemy({
      position: { x: 1, y: 1 },
      statuses: [],
    });
    const run = createTestRunState({
      enemies: new Map([[posKey(nearbyEnemy.position), nearbyEnemy]]),
    });
    const base = createTestGameState({
      phase: 'dungeon',
      player: {
        ringMastery: {
          fire: {
            xp: 10_000,
          },
        },
      },
    });
    const state = { ...base, run };

    const result = spreadBurnFromDeadEnemy(state, deadEnemy, alwaysSpreadRng);
    const updatedNearby = result.enemies.get(posKey(nearbyEnemy.position));

    expect(updatedNearby?.statuses.some(status => status.id === 'panic')).toBe(true);
    expect(result.events.some(event => event.type === 'STATUS_APPLIED' && event.statusId === 'panic')).toBe(true);
  });
});
