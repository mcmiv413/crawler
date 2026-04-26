import type { EnemyTemplate } from '@dungeon/contracts';

export const caveRat = {
  templateId: 'cave_rat',
  name: 'Cave Rat',
  archetype: 'skittish_ranged',
  tier: 1,
  stats: {
    maxHealth: 18,
    health: 18,
    attack: 5,
    defense: 1,
    accuracy: 6,
    evasion: 10,
    speed: 125,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'physical',
      weaponRange: 1,
    },
  },
  affinities: {},
  spawn: {
    floorRange: [1, 2],
    weight: 3,
  },
  lootTableId: 'loot_vermin',
  experienceValue: 8,
  description: 'A large, aggressive rat with glowing red eyes.',
  ascii: 'r',
  color: '#aa7755',
  movementBehaviorId: 'rearline_anchor',
  spriteName: 'enormous rat',
  biomes: [{ biomeId: 'stone_crypt' }, { biomeId: 'goblin_warrens' }, { biomeId: 'forest' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'swarmer',
} as const satisfies EnemyTemplate;
