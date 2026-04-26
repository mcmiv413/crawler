import type { EnemyTemplate } from '@dungeon/contracts';

export const mireToad = {
  templateId: 'mire_toad',
  name: 'Mire Toad',
  archetype: 'ambusher',
  tier: 2,
  stats: {
    maxHealth: 26,
    health: 26,
    attack: 8,
    defense: 2,
    accuracy: 5,
    evasion: 6,
    speed: 100,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'poison',
      weaponRange: 1,
      onHitStatus: 'poison',
      onHitChance: 0.5,
    },
  },
  affinities: { poison: 0.6 },
  spawn: {
    floorRange: [2, 4],
    weight: 2,
  },
  lootTableId: 'loot_vermin',
  experienceValue: 18,
  description: 'A bloated amphibian secreting toxic slime.',
  ascii: 't',
  color: '#88aa44',
  movementBehaviorId: 'ambush_idle',
  spriteName: 'frog',
  biomes: [{ biomeId: 'forest' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'wall_lurker',
} as const satisfies EnemyTemplate;
