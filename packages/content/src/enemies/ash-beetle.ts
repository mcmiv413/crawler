import type { EnemyTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const ashBeetle = {
  templateId: 'ash_beetle',
  name: 'Ash Beetle',
  archetype: 'ambusher',
  tier: 2,
  stats: {
    maxHealth: 38,
    health: 38,
    attack: 14,
    defense: 5,
    accuracy: 68,
    evasion: 16,
    speed: 95,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.1,
      damageType: 'fire',
      range: 1,
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
  sprite: SPRITE_MAP['enemy:pit_spider'], // placeholder
  biomes: [{ biomeId: 'volcanic' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'wall_lurker',
} as const satisfies EnemyTemplate;
