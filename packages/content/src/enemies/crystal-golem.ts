import type { EnemyTemplate } from '@dungeon/contracts';

export const crystalGolem = {
  templateId: 'crystal_golem',
  name: 'Crystal Golem',
  archetype: 'aggressive_melee',
  tier: 3,
  stats: {
    maxHealth: 56,
    health: 56,
    attack: 11,
    defense: 9,
    accuracy: 4,
    evasion: 1,
    speed: 64,
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
  spriteName: 'crystal golem',
  biomes: [{ biomeId: 'crystal_cave' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
