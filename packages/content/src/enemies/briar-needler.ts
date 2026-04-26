import type { EnemyTemplate } from '@dungeon/contracts';

export const briarNeedler = {
  templateId: 'briar_needler',
  name: 'Briar Needler',
  archetype: 'skittish_ranged',
  tier: 2,
  stats: {
    maxHealth: 18,
    health: 18,
    attack: 6,
    defense: 1,
    accuracy: 7,
    evasion: 8,
    speed: 110,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'poison',
      weaponRange: 2,
      onHitStatus: 'poison',
      onHitChance: 0.4,
    },
  },
  affinities: { poison: 0.6 },
  spawn: {
    floorRange: [2, 4],
    weight: 2,
  },
  lootTableId: 'loot_vermin',
  experienceValue: 15,
  description: 'A thorny plant creature that launches poisoned needles.',
  ascii: 'n',
  color: '#66aa55',
  movementBehaviorId: 'wall_stalker',
  spriteName: 'killer beetle',
  biomes: [{ biomeId: 'forest' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
