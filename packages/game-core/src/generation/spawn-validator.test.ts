/**
 * Test layer: unit
 * Behavior: Spawn Validator covers validateSpawns; returns valid when no enemies are present; returns invalid when an enemy is on the entrance tile.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/generation/spawn-validator.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { validateSpawns } from './spawn-validator.js';
import { generateFloor } from './map-generator.js';
import { SeededRNG } from '../utils/rng.js';
import { posKey } from '@dungeon/contracts';
import type { EnemyInstance, DungeonFloor } from '@dungeon/contracts';
import { createTestEnemy } from '../test-utils.js';

type BiomeDefinition = Parameters<typeof generateFloor>[1];

const STUB_BIOME: BiomeDefinition = {
  biomeId: 'stub',
  name: 'Stub',
  description: 'Test stub biome',
  floorRange: { min: 1, max: 5 },
  tileWeights: { floor: 0.55, wall: 0.35, door: 0.1 },
  ambientColor: '#444444',
  floorAscii: '.',
  wallAscii: '#',
  mapGen: {
    roomWidth: [3, 5],
    roomHeight: [2, 4],
    corridorLength: [1, 3],
    dugPercentage: 0.38,
  },
};

describe('validateSpawns', () => {
  // Generate a real floor so entrance/exit are valid
  let floor: DungeonFloor;

  beforeAll(() => {
    const rng = new SeededRNG(42);
    ({ floor } = generateFloor(1, STUB_BIOME, rng));
  });

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

  it('returns invalid at exact boundary distance of 2 tiles', () => {
    const boundaryPos = { x: floor.entrance.x + 2, y: floor.entrance.y };
    const enemies = new Map<string, EnemyInstance>();
    enemies.set(posKey(boundaryPos), createTestEnemy({ position: boundaryPos }));
    const result = validateSpawns(floor, enemies);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('too close'))).toBe(true);
  });

  it('returns valid at distance greater than 2 tiles', () => {
    const safePos = { x: floor.entrance.x + 3, y: floor.entrance.y };
    const enemies = new Map<string, EnemyInstance>();
    enemies.set(posKey(safePos), createTestEnemy({ position: safePos }));
    const result = validateSpawns(floor, enemies);
    const proximityIssues = result.issues.filter(i => i.includes('too close'));
    expect(proximityIssues).toHaveLength(0);
  });

  it('returns invalid when enemy is on exit tile', () => {
    const enemies = new Map<string, EnemyInstance>();
    enemies.set(posKey(floor.exit), createTestEnemy({ position: floor.exit }));
    const result = validateSpawns(floor, enemies);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('exit'))).toBe(true);
  });

  it('returns invalid when too many enemies (exceeds limit)', () => {
    const enemies = new Map<string, EnemyInstance>();
    // Add 25 enemies (exceeds maxEnemies = 20)
    for (let i = 0; i < 25; i++) {
      const pos = { x: floor.entrance.x + 10 + i, y: floor.entrance.y };
      enemies.set(posKey(pos), createTestEnemy({ id: `enemy_${i}` as any, position: pos }));
    }
    const result = validateSpawns(floor, enemies);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('Too many enemies'))).toBe(true);
  });

  it('handles multiple violations in single validation', () => {
    const enemies = new Map<string, EnemyInstance>();
    // Violation 1: Enemy on entrance
    enemies.set(posKey(floor.entrance), createTestEnemy({ position: floor.entrance }));
    // Violation 2: Enemy on exit
    enemies.set(posKey(floor.exit), createTestEnemy({ id: 'exit_enemy' as any, position: floor.exit }));
    // Violation 3: Enemy too close (distance 1)
    const nearPos = { x: floor.entrance.x + 1, y: floor.entrance.y };
    enemies.set(posKey(nearPos), createTestEnemy({ id: 'near_enemy' as any, position: nearPos }));

    const result = validateSpawns(floor, enemies);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
    expect(result.issues.some(i => i.includes('entrance'))).toBe(true);
    expect(result.issues.some(i => i.includes('exit'))).toBe(true);
    expect(result.issues.some(i => i.includes('too close'))).toBe(true);
  });

  it('exit reachability is validated independently', () => {
    // Test that exit reachability check runs
    // We use the same floor which should have reachable exit
    const enemies = new Map<string, EnemyInstance>();
    enemies.set(posKey({ x: 1, y: 1 }), createTestEnemy({ position: { x: 1, y: 1 } }));
    const result = validateSpawns(floor, enemies);
    
    // Exit should be reachable in this floor, so no reachability issue
    const reachabilityIssues = result.issues.filter(i => i.includes('Exit'));
    expect(reachabilityIssues).toHaveLength(0);
  });

  it('validates Chebyshev distance correctly (diagonal and axis-aligned)', () => {
    // Chebyshev distance: max(dx, dy)
    // Test diagonal at exact distance 2
    const diagonalPos = { x: floor.entrance.x + 2, y: floor.entrance.y + 2 };
    const enemies = new Map<string, EnemyInstance>();
    enemies.set(posKey(diagonalPos), createTestEnemy({ position: diagonalPos }));
    
    const result = validateSpawns(floor, enemies);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('too close'))).toBe(true);
  });

  it('validates exact boundary at distance 3 (should be valid)', () => {
    // Distance 3 should be safe
    const safePos = { x: floor.entrance.x + 3, y: floor.entrance.y + 0 };
    const enemies = new Map<string, EnemyInstance>();
    enemies.set(posKey(safePos), createTestEnemy({ position: safePos }));
    
    const result = validateSpawns(floor, enemies);
    const proximityIssues = result.issues.filter(i => i.includes('too close'));
    expect(proximityIssues).toHaveLength(0);
  });

  it('handles empty floor gracefully', () => {
    const result = validateSpawns(floor, new Map());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
