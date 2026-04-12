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
    expect(ENEMY_RESPAWN).toBeDefined();
    expect(ENEMY_RESPAWN.respawnIntervalTurns).toBeDefined();
    expect(ENEMY_RESPAWN.maxEnemiesOnFloor).toBeDefined();
    expect(ENEMY_RESPAWN.minSpawnDistFromPlayer).toBeDefined();
    expect(ENEMY_RESPAWN.respawnCountPerTick).toBeDefined();
  });
});
