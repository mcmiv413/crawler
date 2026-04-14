import type { EnemyTemplate } from '@dungeon/contracts';

export const dungeonOgre = {
  templateId: 'dungeon_ogre',
  name: 'Dungeon Ogre',
  archetype: 'aggressive_melee',
  tier: 4,
  stats: {
    maxHealth: 120,
    health: 120,
    attack: 22,
    defense: 12,
    accuracy: 60,
    evasion: 5,
    speed: 70,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.3,
      damageType: 'physical',
      range: 1,
    },
  },
  affinities: { physical: 0.15 },
  spawn: {
    floorRange: [3, 5],
    weight: 1,
  },
  lootTableId: 'loot_elite',
  experienceValue: 60,
  description: 'A massive ogre blocking the passage, club in hand.',
  ascii: 'O',
  color: '#558855',
  spriteName: 'ogre',
  biomes: [{ biomeId: 'frozen_depths' }],
  factions: [{ factionId: 'goblin_warband', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
