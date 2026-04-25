import type { EnemyTemplate } from '@dungeon/contracts';

export const chainSpecter = {
  templateId: 'chain_specter',
  name: 'Chain Specter',
  archetype: 'ambusher',
  tier: 3,
  stats: {
    maxHealth: 30,
    health: 30,
    attack: 10,
    defense: 3,
    accuracy: 8,
    evasion: 11,
    speed: 112,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.1,
      damageType: 'shadow',
      range: 2,
    },
  },
  affinities: { shadow: 0.7, corruption: 0.4 },
  spawn: {
    floorRange: [5, 7],
    weight: 1,
  },
  lootTableId: 'loot_shadow',
  experienceValue: 40,
  description: 'A phantasmal creature bound in spectral chains.',
  ascii: 'X',
  color: '#664488',
  movementBehaviorId: 'ambush_idle',
  spriteName: 'phase spider',
  biomes: [{ biomeId: 'frozen_depths' }],
  factions: [{ factionId: 'shadow_cult', weight: 1.0 }],
  ambientBehaviorProfile: 'wall_lurker',
} as const satisfies EnemyTemplate;
