// Auto-generated — do not edit manually
import type { BiomeDefinition } from './stone-crypt.js';
import { crystalCave } from './crystal-cave.js';
import { forest } from './forest.js';
import { frozenDepths } from './frozen-depths.js';
import { goblinWarrens } from './goblin-warrens.js';
import { mossCaverns } from './moss-caverns.js';
import { stoneCrypt } from './stone-crypt.js';
import { volcanic } from './volcanic.js';

const items: [string, BiomeDefinition][] = [
  [crystalCave.biomeId, crystalCave],
  [forest.biomeId, forest],
  [frozenDepths.biomeId, frozenDepths],
  [goblinWarrens.biomeId, goblinWarrens],
  [mossCaverns.biomeId, mossCaverns],
  [stoneCrypt.biomeId, stoneCrypt],
  [volcanic.biomeId, volcanic],
];

export const BIOME_DEFINITIONS: ReadonlyMap<string, BiomeDefinition> = new Map(items);

export const BIOMES = BIOME_DEFINITIONS;
export type { BiomeDefinition } from './stone-crypt.js';

export {
  crystalCave, forest, frozenDepths, goblinWarrens, mossCaverns, stoneCrypt, volcanic,
};

export * from './utilities.js';

// Add custom utilities below this line ↓
