import type { SpriteRect } from '@dungeon/contracts';
import { DAWNLIKE_ATLAS } from './dawnlike-atlas-raw.js';

export const DAWNLIKE_NAME_MAP: Record<string, string> = {
  // Player
  'player': 'knight',

  // Generic tile fallbacks
  'tile:floor': 'day brick floor c',
  'tile:wall': 'dark brick wall center',
  'tile:stairs_down': 'large stairs down',
  'tile:stairs_up': 'large stairs up',
  'tile:chest': 'closed chest',
  'tile:door': 'closed stone door front',
  'tile:hazard': 'lava flow up down',
  'tile:interactable': 'statue',
  'tile:event': 'magic bag',
  'tile:obstacle': 'boulder',

  // Per-biome tile overrides
  'tile:floor:stone_crypt': 'day stone floor c',
  'tile:wall:stone_crypt': 'dark brick wall center',
  'tile:floor:forest': 'day grass floor c',
  'tile:wall:forest': 'trunk a',
  'tile:wall:forest:alt1': 'trunk b',
  'tile:floor:goblin_warrens': 'day dirt floor c',
  'tile:wall:goblin_warrens': 'dark mine wall center',
  'tile:floor:moss_caverns': 'day tile floor c',
  'tile:wall:moss_caverns': 'bright rock wall center',
  'tile:wall:moss_caverns:alt1': 'bright rock wall flat',
  'tile:floor:volcanic': 'day brick floor c',
  'tile:wall:volcanic': 'lit heat wall center',
  'tile:floor:crystal_cave': 'day tile floor c',
  'tile:wall:crystal_cave': 'bright blue wall center',
  'tile:wall:crystal_cave:alt1': 'bright blue wall flat',
  'tile:floor:frozen_depths': 'day stone floor c',
  'tile:wall:frozen_depths': 'bright ice wall center',
  'tile:wall:frozen_depths:alt1': 'bright ice wall flat',

  // Enemies
  'enemy:skeleton_warrior': 'skeleton',
  'enemy:cave_rat': 'enormous rat',
  'enemy:goblin_archer': 'goblin',
  'enemy:pit_spider': 'cave spider',
  'enemy:frost_wraith': 'wraith',
  'enemy:moss_golem': 'clay golem',
  'enemy:shadow_lurker': 'shadow skeleton',
  'enemy:fire_imp': 'imp',
  'enemy:dungeon_ogre': 'ogre',
  'enemy:shard_priest': 'high priest',
  'enemy:ember_bat': 'baby bat',
  'enemy:ash_beetle': 'giant beetle',
  'enemy:crystal_golem': 'crystal golem',
  'enemy:bone_shaman': 'shaman karnov',
  'enemy:chain_specter': 'phase spider',
  'enemy:briar_needler': 'killer beetle',
  'enemy:mire_toad': 'frog',

  // Items
  'item:health_potion': 'purple red potion',
  'item:health_potion_large': 'purple red potion',
  'item:mana_potion': 'brilliant blue potion',
  'item:mana_potion_large': 'sky blue potion',
  'item:iron_sword': 'dwarvish short sword',

  // Objects
  'object:chest': 'closed chest',
  'object:healing_fountain': 'fountain',
  'object:arcane_altar': 'altar',
  'object:fire_pit': 'fire beam h',
  'object:inferno_pit': 'big flame',
  'object:trap_spikes': 'spiked pit tile',
  'object:poison_trap': 'bear trap tile',
  'object:frost_trap': 'bright ice wall center',
  'object:lightning_trap': 'electric eel',
};

export function resolveSprite(gameKey: string): SpriteRect | undefined {
  const atlasName = DAWNLIKE_NAME_MAP[gameKey];
  if (!atlasName) return undefined;
  return DAWNLIKE_ATLAS[atlasName] as SpriteRect | undefined;
}
