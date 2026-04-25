import type { EnemyTemplate } from '@dungeon/contracts';

export const boneShaman = {
  templateId: 'bone_shaman',
  name: 'Bone Shaman',
  archetype: 'cautious_defensive',
  tier: 3,
  stats: {
    maxHealth: 32,
    health: 32,
    attack: 7,
    defense: 3,
    accuracy: 8,
    evasion: 8,
    speed: 86,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'shadow',
      range: 2,
    },
  },
  affinities: { shadow: 0.6, poison: 0.3 },
  spawn: {
    floorRange: [4, 6],
    weight: 1,
  },
  lootTableId: 'loot_shadow',
  experienceValue: 32,
  description: 'An undead skeletal mage wielding shadow magic.',
  ascii: 'H',
  color: '#5533aa',
  movementBehaviorId: 'rearline_anchor',
  spriteName: 'shaman karnov',
  biomes: [{ biomeId: 'frozen_depths' }],
  factions: [{ factionId: 'undead_legion', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
