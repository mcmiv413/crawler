import type { RNG } from '@dungeon/contracts';
import type { BiomeDefinition } from './stone-crypt.js';
import { stoneCrypt } from './stone-crypt.js';
import { goblinWarrens } from './goblin-warrens.js';
import { mossCaverns } from './moss-caverns.js';
import { frozenDepths } from './frozen-depths.js';
import { forest } from './forest.js';
import { volcanic } from './volcanic.js';
import { crystalCave } from './crystal-cave.js';

export type { BiomeDefinition };

export const BIOMES: ReadonlyMap<string, BiomeDefinition> = new Map([
  [stoneCrypt.biomeId, stoneCrypt],
  [goblinWarrens.biomeId, goblinWarrens],
  [mossCaverns.biomeId, mossCaverns],
  [frozenDepths.biomeId, frozenDepths],
  [forest.biomeId, forest],
  [volcanic.biomeId, volcanic],
  [crystalCave.biomeId, crystalCave],
]);

export const BIOME_BY_FLOOR = (depth: number, rng: RNG): BiomeDefinition => {
  // Collect all biomes compatible with this depth
  const mutableCompatible: BiomeDefinition[] = [];
  for (const biome of BIOMES.values()) {
    if (depth >= biome.floorRange.min && depth <= biome.floorRange.max) {
      mutableCompatible.push(biome);
    }
  }

  if (mutableCompatible.length === 0) return stoneCrypt; // fallback

  // Sort for deterministic selection
  mutableCompatible.sort((a, b) => a.biomeId.localeCompare(b.biomeId));
  const index = rng.int(0, mutableCompatible.length - 1);
  return mutableCompatible[index] ?? stoneCrypt;
};

export { stoneCrypt, goblinWarrens, mossCaverns, frozenDepths, forest, volcanic, crystalCave };
