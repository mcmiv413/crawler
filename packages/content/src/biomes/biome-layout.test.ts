/**
 * Test layer: unit
 * Behavior: Biome Layout covers BiomeDefinition.mapGen; every biome has mapGen params; forest rooms are wider than goblin_warrens rooms.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/content/src/biomes/biome-layout.test.ts
 */
import { describe, it, expect } from 'vitest';
import { BIOMES } from './index.js';

describe('BiomeDefinition.mapGen', () => {
  it('every biome has mapGen params', () => {
    for (const [id, biome] of BIOMES) {
      expect(biome.mapGen, `${id} missing mapGen`).toEqual(expect.objectContaining({
        corridorLength: expect.any(Array),
        dugPercentage: expect.any(Number),
        roomHeight: expect.any(Array),
        roomWidth: expect.any(Array),
      }));
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
