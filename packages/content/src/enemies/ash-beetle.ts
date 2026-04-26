import type { EnemyTemplate } from '@dungeon/contracts';

export const ashBeetle = {
  templateId: 'ash_beetle',
  name: 'Ash Beetle',
  archetype: 'ambusher',
  tier: 2,
  stats: {
    maxHealth: 28,
    health: 28,
    attack: 8,
    defense: 4,
    accuracy: 5,
    evasion: 5,
    speed: 92,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.1,
      damageType: 'fire',
      weaponRange: 1,
    },
  },
  affinities: { fire: 0.7, frost: -0.4 },
  spawn: {
    floorRange: [3, 5],
    weight: 2,
  },
  lootTableId: 'loot_elemental',
  experienceValue: 22,
  description: 'A smoldering insect armored in hardened carapace.',
  ascii: 'a',
  color: '#dd6644',
  movementBehaviorId: 'ambush_idle',
  spriteName: 'giant beetle',
  biomes: [{ biomeId: 'volcanic' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'wall_lurker',
} as const satisfies EnemyTemplate;
