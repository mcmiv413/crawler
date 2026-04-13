import type { EnemyTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const emberBat = {
  templateId: 'ember_bat',
  name: 'Ember Bat',
  archetype: 'skittish_ranged',
  tier: 2,
  stats: {
    maxHealth: 28,
    health: 28,
    attack: 12,
    defense: 2,
    accuracy: 76,
    evasion: 22,
    speed: 125,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'fire',
      range: 2,
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
  sprite: SPRITE_MAP['enemy:ember_bat'],
  biomes: [{ biomeId: 'volcanic' }],
  factions: [{ factionId: 'shadow_cult', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
