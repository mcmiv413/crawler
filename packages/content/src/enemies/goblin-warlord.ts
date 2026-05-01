import type { EnemyTemplate } from '@dungeon/contracts';

export const goblinWarlord = {
  templateId: 'goblin_warlord',
  name: 'Goblin Warlord',
  archetype: 'boss',
  tier: 3,
  stats: {
    maxHealth: 44,
    health: 44,
    attack: 11,
    defense: 4,
    accuracy: 8,
    evasion: 5,
    speed: 92,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.2,
      damageType: 'physical',
      weaponRange: 1,
    },
  },
  affinities: {},
  spawn: {
    floorRange: [2, 5],
    weight: 0,
  },
  lootTableId: 'loot_elite',
  experienceValue: 42,
  description: 'A brutal goblin commander draped in trophies from fallen delvers.',
  ascii: 'K',
  color: '#88bb55',
  spriteName: 'goblin king',
  biomes: [{ biomeId: 'goblin_warrens' }],
  factions: [{ factionId: 'goblin_warband', weight: 1 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
