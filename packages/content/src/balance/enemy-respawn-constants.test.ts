/**
 * Test layer: unit
 * Behavior: Enemy Respawn Constants covers ENEMY_RESPAWN constants; respawnIntervalTurns is a positive integer (respawns happen regularly); maxEnemiesOnFloor is a positive integer....
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/content/src/balance/enemy-respawn-constants.test.ts
 */
import { describe, it, expect } from 'vitest';
import { ENEMY_RESPAWN } from './tables.js';

describe('ENEMY_RESPAWN constants', () => {
  it('respawnIntervalTurns is a positive integer (respawns happen regularly)', () => {
    expect(ENEMY_RESPAWN.respawnIntervalTurns).toBeGreaterThan(0);
    expect(Number.isInteger(ENEMY_RESPAWN.respawnIntervalTurns)).toBe(true);
  });

  it('maxEnemiesOnFloor is a positive integer (cap to prevent overwhelming)', () => {
    expect(ENEMY_RESPAWN.maxEnemiesOnFloor).toBeGreaterThan(0);
    expect(Number.isInteger(ENEMY_RESPAWN.maxEnemiesOnFloor)).toBe(true);
  });

  it('minSpawnDistFromPlayer is non-negative (spawns not too close)', () => {
    expect(ENEMY_RESPAWN.minSpawnDistFromPlayer).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(ENEMY_RESPAWN.minSpawnDistFromPlayer)).toBe(true);
  });

  it('respawnCountPerTick is a positive integer (at least one enemy per respawn)', () => {
    expect(ENEMY_RESPAWN.respawnCountPerTick).toBeGreaterThan(0);
    expect(Number.isInteger(ENEMY_RESPAWN.respawnCountPerTick)).toBe(true);
  });

  it('all constants exist and are defined', () => {
    expect(Object.keys(ENEMY_RESPAWN).sort()).toEqual([
      'maxEnemiesOnFloor',
      'minSpawnDistFromPlayer',
      'respawnCountPerTick',
      'respawnIntervalTurns',
    ]);
  });
});
