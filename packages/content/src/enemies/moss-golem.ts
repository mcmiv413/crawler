import type { EnemyTemplate } from '@dungeon/contracts';

export const mossGolem = {
  templateId: 'moss_golem',
  name: 'Moss Golem',
  archetype: 'aggressive_melee',
  tier: 2,
  stats: {
    maxHealth: 60,
    health: 60,
    attack: 15,
    defense: 10,
    accuracy: 55,
    evasion: 0,
    speed: 60,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.2,
      damageType: 'physical',
      range: 1,
    },
  },
  affinities: { physical: 0.2, fire: -0.3 },
  spawn: {
    floorRange: [2, 4],
    weight: 2,
  },
  lootTableId: 'loot_golem',
  experienceValue: 30,
  description: 'A hulking construct of stone and moss.',
  ascii: 'G',
  color: '#77aa77',
  movementBehaviorId: 'chokepoint_holder',
  spriteName: 'clay golem',
  biomes: [{ biomeId: 'moss_caverns' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
