import type { EnemyTemplate } from '@dungeon/contracts';

export const lichCommander = {
  templateId: 'lich_commander',
  name: 'Lich Commander',
  archetype: 'boss',
  tier: 3,
  stats: {
    maxHealth: 52,
    health: 52,
    attack: 13,
    defense: 7,
    accuracy: 7,
    evasion: 3,
    speed: 82,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.2,
      damageType: 'physical',
      weaponRange: 1,
    },
  },
  affinities: { poison: 0.6, corruption: 0.2 },
  spawn: {
    floorRange: [2, 5],
    weight: 0,
  },
  lootTableId: 'loot_elite',
  experienceValue: 48,
  description: 'A deathless marshal whose rusted blade still remembers command.',
  ascii: 'N',
  color: '#d8d8c0',
  spriteName: 'master lich',
  biomes: [{ biomeId: 'stone_crypt' }, { biomeId: 'frozen_depths' }],
  factions: [{ factionId: 'undead_legion', weight: 1 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
