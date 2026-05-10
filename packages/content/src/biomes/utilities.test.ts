import { describe, expect, it } from 'vitest';
import type { FactionState } from '@dungeon/contracts';
import { INITIAL_FACTIONS } from '../factions/index.js';
import { selectBiomeForFloor } from './utilities.js';

function makeWorld(goblin: Partial<FactionState>) {
  return {
    factions: INITIAL_FACTIONS.map(faction =>
      faction.id === 'goblin_warband'
        ? { ...faction, ...goblin }
        : faction,
    ),
  };
}

function countBiomes(world: ReturnType<typeof makeWorld>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 100; i += 1) {
    const biome = selectBiomeForFloor(2, world, { next: () => (i + 0.5) / 100 });
    counts[biome.biomeId] = (counts[biome.biomeId] ?? 0) + 1;
  }
  return counts;
}

describe('selectBiomeForFloor', () => {
  it('biases eligible biome selection toward led dominant factions and away from broken factions', () => {
    const dominantCounts = countBiomes(makeWorld({ status: 'led', power: 100 }));
    const brokenCounts = countBiomes(makeWorld({ status: 'broken', power: 0, leaderSlain: true }));

    expect(dominantCounts.goblin_warrens ?? 0).toBeGreaterThan(brokenCounts.goblin_warrens ?? 0);
  });

  it('keeps broken faction biomes reachable at eligible depths', () => {
    const counts = countBiomes(makeWorld({ status: 'broken', power: 0, leaderSlain: true }));

    expect(counts.goblin_warrens ?? 0).toBeGreaterThan(0);
  });
});
