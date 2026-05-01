import type { EnemyTemplate } from '@dungeon/contracts';

export const broodMatriarch = {
  templateId: 'brood_matriarch',
  name: 'Brood Matriarch',
  archetype: 'boss',
  tier: 3,
  stats: {
    maxHealth: 58,
    health: 58,
    attack: 14,
    defense: 5,
    accuracy: 6,
    evasion: 4,
    speed: 88,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.25,
      damageType: 'physical',
      weaponRange: 1,
    },
  },
  affinities: { fire: 0.2, poison: 0.25 },
  spawn: {
    floorRange: [2, 5],
    weight: 0,
  },
  lootTableId: 'loot_elite',
  experienceValue: 50,
  description: 'A colossal apex beast driving lesser horrors forward with guttural calls.',
  ascii: 'M',
  color: '#997744',
  spriteName: 'queen bee',
  biomes: [
    { biomeId: 'stone_crypt' },
    { biomeId: 'goblin_warrens' },
    { biomeId: 'forest' },
    { biomeId: 'moss_caverns' },
    { biomeId: 'volcanic' },
    { biomeId: 'crystal_cave' },
  ],
  factions: [{ factionId: 'beast_swarm', weight: 1 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
