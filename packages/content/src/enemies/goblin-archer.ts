import type { EnemyTemplate } from '@dungeon/contracts';

export const goblinArcher = {
  templateId: 'goblin_archer',
  name: 'Goblin Archer',
  archetype: 'skittish_ranged',
  tier: 1,
  stats: {
    maxHealth: 16,
    health: 16,
    attack: 5,
    defense: 1,
    accuracy: 7,
    evasion: 6,
    speed: 95,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'physical',
      range: 3,
    },
  },
  affinities: {},
  spawn: {
    floorRange: [1, 2],
    weight: 2,
  },
  lootTableId: 'loot_goblin',
  experienceValue: 12,
  description: 'A sneaky goblin with a short bow.',
  ascii: 'g',
  color: '#66aa55',
  movementBehaviorId: 'rearline_anchor',
  spriteName: 'goblin',
  biomes: [{ biomeId: 'goblin_warrens' }],
  factions: [{ factionId: 'goblin_warband', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
