import type { EnemyTemplate } from '@dungeon/contracts';

export const shadowLurker = {
  templateId: 'shadow_lurker',
  name: 'Shadow Lurker',
  archetype: 'ambusher',
  tier: 2,
  stats: {
    maxHealth: 24,
    health: 24,
    attack: 9,
    defense: 2,
    accuracy: 8,
    evasion: 12,
    speed: 120,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.1,
      damageType: 'corruption',
      range: 1,
    },
  },
  affinities: { corruption: 0.5 },
  spawn: {
    floorRange: [2, 4],
    weight: 1,
  },
  lootTableId: 'loot_shadow',
  experienceValue: 25,
  description: 'A dark creature that strikes from the shadows.',
  ascii: 'L',
  color: '#5533aa',
  movementBehaviorId: 'ambush_idle',
  spriteName: 'shadow skeleton',
  biomes: [{ biomeId: 'moss_caverns' }, { biomeId: 'frozen_depths' }],
  factions: [{ factionId: 'shadow_cult', weight: 1.0 }],
  ambientBehaviorProfile: 'wall_lurker',
} as const satisfies EnemyTemplate;
