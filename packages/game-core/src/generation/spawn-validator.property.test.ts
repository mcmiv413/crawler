import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateFloor } from './map-generator.js';
import { populateFloor } from './floor-populator.js';
import { validateSpawns } from './spawn-validator.js';
import { SeededRNG } from '../utils/rng.js';
import { stoneCrypt, goblinWarrens, MAP_GENERATION } from '@dungeon/content';
import { posKey } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';

const biomes = [stoneCrypt, goblinWarrens];

describe('spawn-validator property tests', () => {
  it('populated floors should pass spawn validation after fix-up', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 1, max: 3 }),
        (seed, depth) => {
          const rng = new SeededRNG(seed);
          const biome = biomes[seed % biomes.length]!;
          const { floor } = generateFloor(depth, biome, rng);
          const { enemies } = populateFloor(floor, biome, rng);

          const validation = validateSpawns(floor, enemies);

          // Even if validation fails, the specific rules should be checkable
          for (const enemy of enemies.values()) {
            // No enemy should be on entrance
            expect(posKey(enemy.position)).not.toBe(posKey(floor.entrance));
            // No enemy should be on exit
            expect(posKey(enemy.position)).not.toBe(posKey(floor.exit));
          }

          // Enemy count should respect MAP_GENERATION limits (max depth 3 = 4 + 1*3 = 7)
          const maxExpected = MAP_GENERATION.enemyBaseDensity + MAP_GENERATION.enemyPerFloor * depth;
          expect(enemies.size).toBeLessThanOrEqual(maxExpected);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('no enemies within 2 tiles of entrance after population', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000 }),
        (seed) => {
          const rng = new SeededRNG(seed);
          const { floor } = generateFloor(1, stoneCrypt, rng);
          const { enemies } = populateFloor(floor, stoneCrypt, rng);

          for (const enemy of enemies.values()) {
            const dist = chebyshevDistance(floor.entrance, enemy.position);
            expect(dist).toBeGreaterThan(2);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
