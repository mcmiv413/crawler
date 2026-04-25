import type { EnemyTemplate } from '@dungeon/contracts';

export const frostWraith = {
  templateId: 'frost_wraith',
  name: 'Frost Wraith',
  archetype: 'cautious_defensive',
  tier: 3,
  stats: {
    maxHealth: 34,
    health: 34,
    attack: 7,
    defense: 4,
    accuracy: 8,
    evasion: 9,
    speed: 92,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'frost',
      range: 2,
    },
  },
  affinities: { frost: 0.8, fire: -0.5 },
  spawn: {
    floorRange: [3, 5],
    weight: 1,
  },
  lootTableId: 'loot_wraith',
  experienceValue: 35,
  description: 'A spectral figure radiating bitter cold.',
  ascii: 'W',
  color: '#aaddff',
  spriteName: 'wraith',
  biomes: [{ biomeId: 'frozen_depths' }],
  factions: [{ factionId: 'undead_legion', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
