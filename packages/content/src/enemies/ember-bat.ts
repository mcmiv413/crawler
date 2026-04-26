import type { EnemyTemplate } from '@dungeon/contracts';

export const emberBat = {
  templateId: 'ember_bat',
  name: 'Ember Bat',
  archetype: 'skittish_ranged',
  tier: 2,
  stats: {
    maxHealth: 20,
    health: 20,
    attack: 6,
    defense: 1,
    accuracy: 7,
    evasion: 10,
    speed: 128,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'fire',
      weaponRange: 3,
    },
  },
  affinities: { fire: 0.7, frost: -0.4 },
  spawn: {
    floorRange: [3, 5],
    weight: 2,
  },
  lootTableId: 'loot_elemental',
  experienceValue: 20,
  description: 'A fiery winged creature that attacks from above.',
  ascii: 'b',
  color: '#ff6644',
  movementBehaviorId: 'rearline_anchor',
  spriteName: 'baby bat',
  biomes: [{ biomeId: 'volcanic' }],
  factions: [{ factionId: 'shadow_cult', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
