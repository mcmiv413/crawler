import { describe, it, expect } from 'vitest';
import { BIOMES } from './index.js';

describe('BiomeDefinition.mapGen', () => {
  it('every biome has mapGen params', () => {
    for (const [id, biome] of BIOMES) {
      expect(biome.mapGen, `${id} missing mapGen`).toBeDefined();
    }
  });

  it('forest rooms are wider than goblin_warrens rooms', () => {
    expect(BIOMES.get('forest')!.mapGen!.roomWidth[1]).toBeGreaterThan(
      BIOMES.get('goblin_warrens')!.mapGen!.roomWidth[1],
    );
  });

  it('forest dugPercentage is greater than frozen_depths', () => {
    expect(BIOMES.get('forest')!.mapGen!.dugPercentage).toBeGreaterThan(
      BIOMES.get('frozen_depths')!.mapGen!.dugPercentage,
    );
  });
});
