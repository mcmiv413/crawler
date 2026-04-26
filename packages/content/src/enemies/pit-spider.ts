import type { EnemyTemplate } from '@dungeon/contracts';

export const pitSpider = {
  templateId: 'pit_spider',
  name: 'Pit Spider',
  archetype: 'ambusher',
  tier: 1,
  stats: {
    maxHealth: 24,
    health: 24,
    attack: 7,
    defense: 3,
    accuracy: 6,
    evasion: 8,
    speed: 110,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'poison',
      weaponRange: 1,
      onHitStatus: 'poison',
      onHitChance: 0.3,
    },
  },
  affinities: { poison: 0.5 },
  spawn: {
    floorRange: [1, 3],
    weight: 2,
  },
  lootTableId: 'loot_vermin',
  experienceValue: 10,
  description: 'A large spider lurking in the shadows, dripping venom.',
  ascii: 's',
  color: '#884444',
  movementBehaviorId: 'wall_stalker',
  spriteName: 'cave spider',
  biomes: [{ biomeId: 'stone_crypt' }, { biomeId: 'moss_caverns' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'wall_lurker',
} as const satisfies EnemyTemplate;
