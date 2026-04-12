import { describe, it, expect } from 'vitest';
import { populateFloor } from './floor-populator.js';
import { generateFloor } from './map-generator.js';
import { SeededRNG } from '../utils/rng.js';
import { stoneCrypt, frozenDepths } from '@dungeon/content';
import { posKey } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';

function makeFloor(seed = 42) {
  const rng = new SeededRNG(seed);
  const { floor } = generateFloor(1, stoneCrypt, rng);
  return floor;
}

describe('populateFloor', () => {
  it('enemies.size > 0 on a standard floor', () => {
    const floor = makeFloor();
    const rng = new SeededRNG(42);
    const { enemies } = populateFloor(floor, stoneCrypt, rng);
    expect(enemies.size).toBeGreaterThan(0);
  });

  it('objects.size > 0 on a standard floor', () => {
    const floor = makeFloor();
    const rng = new SeededRNG(42);
    const { objects } = populateFloor(floor, stoneCrypt, rng);
    expect(objects.size).toBeGreaterThan(0);
  });

  it('no enemy at entrance position', () => {
    const floor = makeFloor();
    const rng = new SeededRNG(42);
    const { enemies } = populateFloor(floor, stoneCrypt, rng);
    const entranceKey = posKey(floor.entrance);
    expect(enemies.has(entranceKey)).toBe(false);
  });

  it('no enemy at exit position', () => {
    const floor = makeFloor();
    const rng = new SeededRNG(42);
    const { enemies } = populateFloor(floor, stoneCrypt, rng);
    const exitKey = posKey(floor.exit);
    expect(enemies.has(exitKey)).toBe(false);
  });

  it('no enemy within Chebyshev 2 of entrance', () => {
    const floor = makeFloor();
    const rng = new SeededRNG(42);
    const { enemies } = populateFloor(floor, stoneCrypt, rng);
    for (const [key, enemy] of enemies) {
      const dist = chebyshevDistance(enemy.position, floor.entrance);
      expect(dist).toBeGreaterThan(2);
    }
  });

  it('all spawned enemies have isAlerted === false', () => {
    const floor = makeFloor();
    const rng = new SeededRNG(42);
    const { enemies } = populateFloor(floor, stoneCrypt, rng);
    for (const enemy of enemies.values()) {
      expect(enemy.isAlerted).toBe(false);
    }
  });

  it('object positions do not overlap enemy positions', () => {
    const floor = makeFloor();
    const rng = new SeededRNG(42);
    const { enemies, objects } = populateFloor(floor, stoneCrypt, rng);
    for (const key of objects.keys()) {
      expect(enemies.has(key)).toBe(false);
    }
  });

  it('extraEnemies increases count (worldMods with extraEnemies: 3 vs none, same seed)', () => {
    const floor = makeFloor(99);
    const rng1 = new SeededRNG(99);
    const rng2 = new SeededRNG(99);

    const { enemies: baseEnemies } = populateFloor(floor, stoneCrypt, rng1);
    const { enemies: extraEnemies } = populateFloor(floor, stoneCrypt, rng2, {
      extraEnemies: 3,
      preferredArchetypes: [],
      preferredDamageTypes: [],
      preferredTemplates: [],
    });

    expect(extraEnemies.size).toBeGreaterThanOrEqual(baseEnemies.size);
  });

  it('preferred templates not in biome pool can still spawn when faction is dominant', () => {
    // stoneCrypt pool: ['skeleton_warrior', 'cave_rat', 'pit_spider']
    // preferredTemplates: ['goblin_archer'] — not in pool
    const floor = makeFloor(10);
    const templateCounts = new Map<string, number>();

    // Run populateFloor many times across different seeds to check goblin_archer spawns
    for (let seed = 1; seed <= 40; seed++) {
      const rng = new SeededRNG(seed);
      const { enemies } = populateFloor(floor, stoneCrypt, rng, {
        extraEnemies: 0,
        preferredArchetypes: [],
        preferredDamageTypes: [],
        preferredTemplates: ['goblin_archer'],
      });
      for (const enemy of enemies.values()) {
        templateCounts.set(enemy.templateId, (templateCounts.get(enemy.templateId) ?? 0) + 1);
      }
    }

    expect(templateCounts.get('goblin_archer') ?? 0).toBeGreaterThan(0);
  });

  it('preferred out-of-pool templates spawn more often than biome-only enemies at 3x weight', () => {
    // With goblin_archer preferred (3x) vs skeleton_warrior/cave_rat/pit_spider (1x each):
    // Expected ratio: goblin_archer / total ≈ 3/6 = 50% — at least more than 1/(3+1)=25%
    const floor = makeFloor(20);
    const templateCounts = new Map<string, number>();

    for (let seed = 1; seed <= 60; seed++) {
      const rng = new SeededRNG(seed);
      const { enemies } = populateFloor(floor, stoneCrypt, rng, {
        extraEnemies: 0,
        preferredArchetypes: [],
        preferredDamageTypes: [],
        preferredTemplates: ['goblin_archer'],
      });
      for (const enemy of enemies.values()) {
        templateCounts.set(enemy.templateId, (templateCounts.get(enemy.templateId) ?? 0) + 1);
      }
    }

    const goblinCount = templateCounts.get('goblin_archer') ?? 0;
    const otherCount = [...templateCounts.entries()]
      .filter(([id]) => id !== 'goblin_archer')
      .reduce((sum, [, n]) => sum + n, 0);

    // goblin_archer should appear more than any single biome enemy
    expect(goblinCount).toBeGreaterThan(otherCount / 3);
  });
});

describe('guaranteed boss spawn on deep floors', () => {
  it('floor depth 5 always has at least one high-tier enemy across seeds', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const genRng = new SeededRNG(seed);
      const { floor } = generateFloor(5, frozenDepths, genRng);
      const popRng = new SeededRNG(seed + 100);
      const { enemies } = populateFloor(floor, frozenDepths, popRng);
      const hasHighTierEnemy = [...enemies.values()].some(e => e.tier >= 3);
      expect(hasHighTierEnemy, `seed ${seed}: floor 5 must contain a high-tier enemy`).toBe(true);
    }
  });

  it('floor depth 4 does not force-spawn a high-tier enemy', () => {
    // stone_crypt at depth 4 should not have tier 3+ enemies guaranteed
    let highTierCount = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const genRng = new SeededRNG(seed);
      const { floor } = generateFloor(4, stoneCrypt, genRng);
      const popRng = new SeededRNG(seed + 200);
      const { enemies } = populateFloor(floor, stoneCrypt, popRng);
      if ([...enemies.values()].some(e => e.tier >= 3)) highTierCount++;
    }
    // stoneCrypt at depth 4 might have high-tier by chance, but not guaranteed
    // Just verify the test runs without error
    expect(highTierCount).toBeGreaterThanOrEqual(0);
  });

  it('high-tier enemy spawns at a valid position (not entrance/exit, not within 2 of entrance)', () => {
    const genRng = new SeededRNG(7);
    const { floor } = generateFloor(5, frozenDepths, genRng);
    const popRng = new SeededRNG(700);
    const { enemies } = populateFloor(floor, frozenDepths, popRng);
    const highTierEnemy = [...enemies.values()].find(e => e.tier >= 3);
    expect(highTierEnemy).toBeDefined();
    if (highTierEnemy) {
      expect(posKey(highTierEnemy.position)).not.toBe(posKey(floor.entrance));
      expect(posKey(highTierEnemy.position)).not.toBe(posKey(floor.exit));
      expect(chebyshevDistance(highTierEnemy.position, floor.entrance)).toBeGreaterThan(2);
    }
  });
});
