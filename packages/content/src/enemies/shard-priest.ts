import type { EnemyTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const shardPriest = {
  templateId: 'shard_priest',
  name: 'Shard Priest',
  archetype: 'cautious_defensive',
  tier: 3,
  stats: {
    maxHealth: 40,
    health: 40,
    attack: 12,
    defense: 4,
    accuracy: 80,
    evasion: 20,
    speed: 85,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'arcane',
      range: 3,
    },
  },
  affinities: { arcane: 0.7 },
  spawn: {
    floorRange: [4, 6],
    weight: 1,
  },
  lootTableId: 'loot_wraith',
  experienceValue: 30,
  description: 'A mystical creature wielding crystalline magic.',
  ascii: 'C',
  color: '#dd44ff',
  movementBehaviorId: 'rearline_anchor',
  sprite: SPRITE_MAP['enemy:shadow_lurker'], // placeholder
  biomes: [{ biomeId: 'crystal_cave' }],
  factions: [{ factionId: 'shadow_cult', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
