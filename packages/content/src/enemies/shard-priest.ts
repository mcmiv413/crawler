import type { EnemyTemplate } from '@dungeon/contracts';

export const shardPriest = {
  templateId: 'shard_priest',
  name: 'Shard Priest',
  archetype: 'cautious_defensive',
  tier: 3,
  stats: {
    maxHealth: 30,
    health: 30,
    attack: 8,
    defense: 3,
    accuracy: 8,
    evasion: 7,
    speed: 84,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'arcane',
      weaponRange: 3,
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
  spriteName: 'high priest',
  biomes: [{ biomeId: 'crystal_cave' }],
  factions: [{ factionId: 'shadow_cult', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
