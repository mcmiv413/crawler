import { describe, it, expect } from 'vitest';
import { validateSpawns } from './spawn-validator.js';
import { generateFloor } from './map-generator.js';
import { SeededRNG } from '../utils/rng.js';
import { stoneCrypt } from '@dungeon/content';
import { posKey } from '@dungeon/contracts';
import type { EnemyInstance } from '@dungeon/contracts';
import { createTestEnemy } from '../test-utils.js';

describe('validateSpawns', () => {
  // Generate a real floor so entrance/exit are valid
  const rng = new SeededRNG(42);
  const { floor } = generateFloor(1, stoneCrypt, rng);

  it('returns valid when no enemies are present', () => {
    const result = validateSpawns(floor, new Map());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('returns invalid when an enemy is on the entrance tile', () => {
    const enemies = new Map<string, EnemyInstance>();
    enemies.set(posKey(floor.entrance), createTestEnemy({ position: floor.entrance }));
    const result = validateSpawns(floor, enemies);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('entrance'))).toBe(true);
  });

  it('returns invalid when an enemy is within 2 tiles of entrance', () => {
    const nearPos = { x: floor.entrance.x + 1, y: floor.entrance.y };
    const enemies = new Map<string, EnemyInstance>();
    enemies.set(posKey(nearPos), createTestEnemy({ position: nearPos }));
    const result = validateSpawns(floor, enemies);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('too close'))).toBe(true);
  });

  it('returns valid when all enemies are far from entrance', () => {
    const farPos = { x: floor.entrance.x + 10, y: floor.entrance.y + 10 };
    const enemies = new Map<string, EnemyInstance>();
    enemies.set(posKey(farPos), createTestEnemy({ position: farPos }));
    const result = validateSpawns(floor, enemies);
    // May still be invalid if farPos is not a real cell, but no entrance-related issues
    const entranceIssues = result.issues.filter(i => i.includes('entrance') || i.includes('too close'));
    expect(entranceIssues).toHaveLength(0);
  });
});
