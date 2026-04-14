import type { SpriteRect } from '@dungeon/contracts';

export const DAWNLIKE_SPRITE_MAP: Record<string, SpriteRect> = {
  // Player
  player: { x: 1118, y: 603, w: 16, h: 16 },

  // Generic tile fallbacks
  'tile:floor': { x: 668, y: 567, w: 16, h: 16 },
  'tile:wall': { x: 1298, y: 783, w: 16, h: 16 },
  'tile:stairs_down': { x: 1178, y: 909, w: 16, h: 16 },
  'tile:stairs_up': { x: 1298, y: 261, w: 16, h: 16 },
  'tile:chest': { x: 1754, y: 999, w: 16, h: 16 },
  'tile:door': { x: 722, y: 261, w: 16, h: 16 },
  'tile:hazard': { x: 866, y: 639, w: 16, h: 16 },
  'tile:interactable': { x: 470, y: 675, w: 16, h: 16 },
  'tile:event': { x: 1028, y: 837, w: 16, h: 16 },
  'tile:obstacle': { x: 110, y: 383, w: 16, h: 16 },

  // Per-biome tile overrides
  'tile:floor:stone_crypt': { x: 668, y: 567, w: 16, h: 16 },
  'tile:wall:stone_crypt': { x: 1298, y: 783, w: 16, h: 16 },
  'tile:interactable:stone_crypt': { x: 812, y: 261, w: 16, h: 16 },

  'tile:floor:forest': { x: 476, y: 909, w: 16, h: 16 },
  'tile:wall:forest': { x: 1262, y: 153, w: 16, h: 16 },
  'tile:interactable:forest': { x: 848, y: 9, w: 16, h: 16 },

  'tile:floor:goblin_warrens': { x: 1154, y: 837, w: 16, h: 16 },
  'tile:wall:goblin_warrens': { x: 1244, y: 27, w: 16, h: 16 },
  'tile:interactable:goblin_warrens': { x: 200, y: 743, w: 16, h: 16 },

  'tile:floor:moss_caverns': { x: 476, y: 909, w: 16, h: 16 },
  'tile:wall:moss_caverns': { x: 1298, y: 783, w: 16, h: 16 },
  'tile:interactable:moss_caverns': { x: 1820, y: 747, w: 16, h: 16 },

  'tile:floor:volcanic': { x: 350, y: 891, w: 16, h: 16 },
  'tile:wall:volcanic': { x: 1244, y: 27, w: 16, h: 16 },
  'tile:interactable:volcanic': { x: 470, y: 675, w: 16, h: 16 },

  'tile:floor:crystal_cave': { x: 236, y: 77, w: 16, h: 16 },
  'tile:wall:crystal_cave': { x: 1568, y: 459, w: 16, h: 16 },
  'tile:interactable:crystal_cave': { x: 812, y: 261, w: 16, h: 16 },

  'tile:floor:frozen_depths': { x: 236, y: 77, w: 16, h: 16 },
  'tile:wall:frozen_depths': { x: 1298, y: 783, w: 16, h: 16 },
  'tile:interactable:frozen_depths': { x: 1820, y: 747, w: 16, h: 16 },

  // Enemies - all unique sprites
  'enemy:skeleton_warrior': { x: 1388, y: 657, w: 16, h: 16 },
  'enemy:cave_rat': { x: 416, y: 585, w: 16, h: 16 },
  'enemy:goblin_archer': { x: 1442, y: 261, w: 16, h: 16 },
  'enemy:pit_spider': { x: 830, y: 369, w: 16, h: 16 },
  'enemy:frost_wraith': { x: 1190, y: 207, w: 16, h: 16 },
  'enemy:moss_golem': { x: 1028, y: 81, w: 16, h: 16 },
  'enemy:shadow_lurker': { x: 722, y: 207, w: 16, h: 16 },
  'enemy:fire_imp': { x: 326, y: 747, w: 16, h: 16 },
  'enemy:dungeon_ogre': { x: 20, y: 635, w: 16, h: 16 },
  'enemy:shard_priest': { x: 1046, y: 153, w: 16, h: 16 },
  'enemy:ember_bat': { x: 434, y: 243, w: 16, h: 16 },
  'enemy:ash_beetle': { x: 668, y: 351, w: 16, h: 16 },
  'enemy:crystal_golem': { x: 128, y: 761, w: 16, h: 16 },
  'enemy:bone_shaman': { x: 1028, y: 477, w: 16, h: 16 },
  'enemy:chain_specter': { x: 308, y: 45, w: 16, h: 16 },
  'enemy:briar_needler': { x: 506, y: 261, w: 16, h: 16 },
  'enemy:mire_toad': { x: 1172, y: 117, w: 16, h: 16 },

  // Items
  'item:health_potion': { x: 2, y: 707, w: 16, h: 16 },
  'item:health_potion_large': { x: 1604, y: 711, w: 16, h: 16 },
  'item:mana_potion': { x: 830, y: 801, w: 16, h: 16 },
  'item:mana_potion_large': { x: 236, y: 167, w: 16, h: 16 },
  'item:iron_sword': { x: 218, y: 59, w: 16, h: 16 },

  // Objects - all unique sprites
  'object:chest': { x: 1754, y: 999, w: 16, h: 16 },
  'object:healing_fountain': { x: 1028, y: 837, w: 16, h: 16 },
  'object:arcane_altar': { x: 470, y: 675, w: 16, h: 16 },
  'object:fire_pit': { x: 938, y: 297, w: 16, h: 16 },
  'object:trap_spikes': { x: 218, y: 185, w: 16, h: 16 },
};
