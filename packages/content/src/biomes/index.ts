// Auto-generated — do not edit manually
import type { BiomeDefinition } from '@dungeon/contracts';
import { crystalCave } from './crystal-cave.js';
import { forest } from './forest.js';
import { frozenDepths } from './frozen-depths.js';
import { goblinWarrens } from './goblin-warrens.js';
import { mossCaverns } from './moss-caverns.js';
import { stoneCrypt } from './stone-crypt.js';
import { volcanic } from './volcanic.js';

const items: [string, BiomeDefinition][] = [
  [crystalCave.id, crystalCave],
  [forest.id, forest],
  [frozenDepths.id, frozenDepths],
  [goblinWarrens.id, goblinWarrens],
  [mossCaverns.id, mossCaverns],
  [stoneCrypt.id, stoneCrypt],
  [volcanic.id, volcanic],
];

export const BIOME_DEFINITIONS: ReadonlyMap<string, BiomeDefinition> = new Map(items);

export {
  crystalCave, forest, frozenDepths, goblinWarrens, mossCaverns, stoneCrypt, volcanic,
};

// Add custom utilities below this line ↓
