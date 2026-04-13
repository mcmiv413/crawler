import type { EnemyTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const crystalGolem = {
  templateId: 'crystal_golem',
  name: 'Crystal Golem',
  archetype: 'aggressive_melee',
  tier: 3,
  stats: {
    maxHealth: 65,
    health: 65,
    attack: 16,
    defense: 11,
    accuracy: 60,
    evasion: 2,
    speed: 65,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.2,
      damageType: 'physical',
      range: 1,
    },
  },
  affinities: { physical: 0.3, arcane: 0.5 },
  spawn: {
    floorRange: [4, 6],
    weight: 2,
  },
  lootTableId: 'loot_golem',
  experienceValue: 35,
  description: 'A massive construct of glowing crystal shards.',
  ascii: 'R',
  color: '#aaddff',
  movementBehaviorId: 'chokepoint_holder',
  sprite: SPRITE_MAP['enemy:crystal_golem'],
  biomes: [{ biomeId: 'crystal_cave' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
