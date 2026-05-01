import type { EnemyTemplate } from '@dungeon/contracts';

export const shadowHierophant = {
  templateId: 'shadow_hierophant',
  name: 'Shadow Hierophant',
  archetype: 'boss',
  tier: 3,
  stats: {
    maxHealth: 40,
    health: 40,
    attack: 12,
    defense: 4,
    accuracy: 9,
    evasion: 9,
    speed: 112,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.25,
      damageType: 'corruption',
      weaponRange: 2,
      minRange: 1,
    },
  },
  affinities: { corruption: 0.7, fire: 0.2 },
  spawn: {
    floorRange: [2, 5],
    weight: 0,
  },
  lootTableId: 'loot_elite',
  experienceValue: 46,
  description: 'A masked prophet carrying a brazier of whispering shadow.',
  ascii: 'Y',
  color: '#6a44bb',
  spriteName: 'arch priest',
  biomes: [
    { biomeId: 'goblin_warrens' },
    { biomeId: 'moss_caverns' },
    { biomeId: 'frozen_depths' },
    { biomeId: 'crystal_cave' },
    { biomeId: 'volcanic' },
  ],
  factions: [{ factionId: 'shadow_cult', weight: 1 }],
  ambientBehaviorProfile: 'wall_lurker',
} as const satisfies EnemyTemplate;
