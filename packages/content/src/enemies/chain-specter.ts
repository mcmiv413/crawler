import type { EnemyTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const chainSpecter = {
  templateId: 'chain_specter',
  name: 'Chain Specter',
  archetype: 'ambusher',
  tier: 3,
  stats: {
    maxHealth: 40,
    health: 40,
    attack: 15,
    defense: 4,
    accuracy: 82,
    evasion: 28,
    speed: 115,
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
  sprite: SPRITE_MAP['enemy:shadow_lurker'], // placeholder
  biomes: [{ biomeId: 'frozen_depths' }],
  factions: [{ factionId: 'shadow_cult', weight: 1.0 }],
  ambientBehaviorProfile: 'wall_lurker',
} as const satisfies EnemyTemplate;
