import { describe, expect, it } from 'vitest';
import type { BiomeDefinition } from '@dungeon/content';
import { posKey } from '@dungeon/contracts';
import { populateFloor } from './floor-populator.js';
import type { WorldModifiers } from '../systems/world-modifiers.js';
import { generateFloor } from './map-generator.js';
import { chebyshevDistance } from '../utils/grid.js';
import { SeededRNG } from '../utils/rng.js';
import { buildWorldModifiers } from '../systems/world-modifiers.js';
import { createTestGameState } from '../test-utils.js';

// ---------------------------------------------------------------------------
// Local biome fixtures -- avoids importing live @dungeon/content in unit tests
// ---------------------------------------------------------------------------

const stoneCrypt: BiomeDefinition = {
  biomeId: 'stone_crypt',
  name: 'Stone Crypt',
  description: 'Ancient burial chambers carved from grey stone.',
  floorRange: { min: 1, max: 3 },
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

const frozenDepths: BiomeDefinition = {
  biomeId: 'frozen_depths',
  name: 'Frozen Depths',
  description: 'Ice-coated corridors where breath crystallizes instantly.',
  floorRange: { min: 4, max: 6 },
  tileWeights: { floor: 0.50, wall: 0.40, door: 0.10 },
  ambientColor: '#3a5a7a',
  floorAscii: '.',
  wallAscii: '█',
  mapGen: {
    roomWidth: [2, 4],
    roomHeight: [2, 3],
    corridorLength: [3, 9],
    dugPercentage: 0.35,
    algorithm: 'cellular',
    fillProbability: 0.48,
    iterations: 5,
  },
};

function makeFloor(seed = 42, depth = 1) {
  const rng = new SeededRNG(seed);
  const { floor } = generateFloor(depth, depth >= 5 ? frozenDepths : stoneCrypt, rng);
  return floor;
}

function makeWorldMods(overrides: Partial<WorldModifiers> = {}): WorldModifiers {
  return {
    extraEnemies: 0,
    preferredArchetypes: [],
    preferredDamageTypes: [],
    factionWeightMultipliers: {},
    factions: createTestGameState().world.factions,
    enemyHealthMultiplier: 1,
    tierUpgradeChance: 0,
    reservedEncounterSlots: 0,
    ...overrides,
  };
}

describe('populateFloor', () => {
  it('spawns enemies and objects at valid positions on a standard floor', () => {
    const floor = makeFloor();
    const rng = new SeededRNG(42);
    const { enemies, objects } = populateFloor(floor, stoneCrypt, rng);

    expect(enemies.size).toBeGreaterThan(0);
    expect(objects.size).toBeGreaterThan(0);
    expect(enemies.has(posKey(floor.entrance))).toBe(false);
    expect(enemies.has(posKey(floor.exit))).toBe(false);

    for (const enemy of enemies.values()) {
      expect(chebyshevDistance(enemy.position, floor.entrance)).toBeGreaterThan(2);
      expect(enemy.isAlerted).toBe(false);
    }

    for (const key of objects.keys()) {
      expect(enemies.has(key)).toBe(false);
    }
  });

  it('extraEnemies increases spawn count for the same floor seed', () => {
    const floor = makeFloor(99);
    const { enemies: baseEnemies } = populateFloor(floor, stoneCrypt, new SeededRNG(99));
    const { enemies: extraEnemies } = populateFloor(
      floor,
      stoneCrypt,
      new SeededRNG(99),
      makeWorldMods({ extraEnemies: 3 }),
    );

    expect(extraEnemies.size).toBeGreaterThanOrEqual(baseEnemies.size);
  });

  it('reserved encounter slots reduce normal spawn count', () => {
    const floor = makeFloor(99);
    const { enemies: baseEnemies } = populateFloor(
      floor,
      stoneCrypt,
      new SeededRNG(99),
      makeWorldMods({ extraEnemies: 3 }),
    );
    const { enemies: reservedEnemies } = populateFloor(
      floor,
      stoneCrypt,
      new SeededRNG(99),
      makeWorldMods({ extraEnemies: 3, reservedEncounterSlots: 2 }),
    );

    expect(reservedEnemies.size).toBeLessThanOrEqual(baseEnemies.size);
  });

  it('faction weight multipliers bias spawns within the biome pool', () => {
    let baseBeastSpawns = 0;
    let boostedBeastSpawns = 0;

    for (let seed = 1; seed <= 40; seed++) {
      const floor = makeFloor(seed);
      const base = populateFloor(floor, stoneCrypt, new SeededRNG(seed), makeWorldMods());
      const boosted = populateFloor(
        floor,
        stoneCrypt,
        new SeededRNG(seed),
        makeWorldMods({ factionWeightMultipliers: { beast_swarm: 3 } }),
      );

      baseBeastSpawns += [...base.enemies.values()].filter(enemy => enemy.factions?.[0]?.factionId === 'beast_swarm').length;
      boostedBeastSpawns += [...boosted.enemies.values()].filter(enemy => enemy.factions?.[0]?.factionId === 'beast_swarm').length;
    }

    expect(boostedBeastSpawns).toBeGreaterThan(baseBeastSpawns);
  });

  it('dominant factions spawn more often than stable factions, while broken factions spawn less often', () => {
    let dominantFactionSpawns = 0;
    let stableFactionSpawns = 0;
    let brokenFactionSpawns = 0;

    for (let seed = 1; seed <= 60; seed++) {
      const floor = makeFloor(seed);
      const stableWorld = createTestGameState().world;
      const dominantWorld = createTestGameState({
        world: {
          factions: createTestGameState().world.factions.map(faction => faction.id === 'beast_swarm'
            ? { ...faction, power: 85, status: 'led' as const }
            : faction),
        },
      }).world;
      const brokenWorld = createTestGameState({
        world: {
          factions: createTestGameState().world.factions.map(faction => faction.id === 'beast_swarm'
            ? { ...faction, power: 5, status: 'broken' as const, leaderSlain: true }
            : faction),
        },
      }).world;

      const stable = populateFloor(floor, stoneCrypt, new SeededRNG(seed), buildWorldModifiers(stableWorld, 1));
      const dominant = populateFloor(floor, stoneCrypt, new SeededRNG(seed), buildWorldModifiers(dominantWorld, 1));
      const broken = populateFloor(floor, stoneCrypt, new SeededRNG(seed), buildWorldModifiers(brokenWorld, 1));

      stableFactionSpawns += [...stable.enemies.values()].filter(enemy => enemy.factions?.[0]?.factionId === 'beast_swarm').length;
      dominantFactionSpawns += [...dominant.enemies.values()].filter(enemy => enemy.factions?.[0]?.factionId === 'beast_swarm').length;
      brokenFactionSpawns += [...broken.enemies.values()].filter(enemy => enemy.factions?.[0]?.factionId === 'beast_swarm').length;
    }

    expect(dominantFactionSpawns).toBeGreaterThan(stableFactionSpawns);
    expect(brokenFactionSpawns).toBeLessThan(stableFactionSpawns);
  });

  it('enemyHealthMultiplier scales spawned enemy health for the same seed', () => {
    const floor = makeFloor(50);
    const { enemies: base } = populateFloor(
      floor,
      stoneCrypt,
      new SeededRNG(50),
      makeWorldMods({ enemyHealthMultiplier: 1 }),
    );
    const { enemies: boosted } = populateFloor(
      floor,
      stoneCrypt,
      new SeededRNG(50),
      makeWorldMods({ enemyHealthMultiplier: 2 }),
    );

    const baseMax = Math.max(...Array.from(base.values()).map(enemy => enemy.stats.maxHealth));
    const boostedMax = Math.max(...Array.from(boosted.values()).map(enemy => enemy.stats.maxHealth));
    expect(boostedMax).toBeGreaterThanOrEqual(baseMax);
  });

  it('tierUpgradeChance increases average enemy tier on deep floors', () => {
    let baseTierTotal = 0;
    let boostedTierTotal = 0;

    for (let seed = 1; seed <= 20; seed++) {
      const floor = makeFloor(seed, 5);
      const base = populateFloor(floor, frozenDepths, new SeededRNG(seed + 100), makeWorldMods());
      const boosted = populateFloor(
        floor,
        frozenDepths,
        new SeededRNG(seed + 100),
        makeWorldMods({ tierUpgradeChance: 0.9 }),
      );

      baseTierTotal += [...base.enemies.values()].reduce((sum, enemy) => sum + enemy.tier, 0);
      boostedTierTotal += [...boosted.enemies.values()].reduce((sum, enemy) => sum + enemy.tier, 0);
    }

    expect(boostedTierTotal).toBeGreaterThanOrEqual(baseTierTotal);
  });

  it('spawns valid enemy stats and instance colors', () => {
    const floor = makeFloor(15);
    const { enemies } = populateFloor(floor, stoneCrypt, new SeededRNG(402), makeWorldMods());

    for (const enemy of enemies.values()) {
      expect(enemy.stats.maxHealth).toBeGreaterThan(0);
      expect(enemy.stats.health).toBeGreaterThan(0);
      expect(enemy.stats.attack).toBeGreaterThan(0);
      expect(enemy.stats.defense).toBeGreaterThanOrEqual(0);
      expect(enemy.experienceValue).toBeGreaterThan(0);
      expect(enemy.instanceColor).toBeDefined();
      const roundTripped = JSON.parse(JSON.stringify(enemy)) as typeof enemy;
      expect(roundTripped.instanceColor).toBeDefined();
    }
  });

  it('assigns different instance colors to repeated templates', () => {
    const floor = makeFloor(42);
    const { enemies } = populateFloor(floor, stoneCrypt, new SeededRNG(42), makeWorldMods());
    const colorsByTemplate = new Map<string, string[]>();

    for (const enemy of enemies.values()) {
      const colors = colorsByTemplate.get(enemy.templateId) ?? [];
      colors.push(enemy.instanceColor!);
      colorsByTemplate.set(enemy.templateId, colors);
    }

    for (const colors of colorsByTemplate.values()) {
      if (colors.length >= 2) {
        expect(new Set(colors).size).toBeGreaterThan(1);
      }
    }
  });
});
