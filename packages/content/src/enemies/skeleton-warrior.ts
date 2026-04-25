import type { EnemyTemplate } from '@dungeon/contracts';

export const skeletonWarrior = {
  templateId: 'skeleton_warrior',
  name: 'Skeleton Warrior',
  archetype: 'aggressive_melee',
  tier: 1,
  stats: {
    maxHealth: 34,
    health: 34,
    attack: 9,
    defense: 6,
    accuracy: 4,
    evasion: 2,
    speed: 80,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'physical',
      range: 1,
    },
  },
  affinities: { poison: 0.5 },
  spawn: {
    floorRange: [1, 3],
    weight: 2,
  },
  lootTableId: 'loot_skeleton',
  experienceValue: 15,
  description: 'An animated skeleton wielding a rusty sword.',
  ascii: 'S',
  color: '#ccccaa',
  movementBehaviorId: 'chokepoint_holder',
  spriteName: 'skeleton',
  biomes: [{ biomeId: 'stone_crypt' }],
  factions: [{ factionId: 'undead_legion', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
