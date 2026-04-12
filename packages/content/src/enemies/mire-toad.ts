import type { EnemyTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const mireToad = {
  templateId: 'mire_toad',
  name: 'Mire Toad',
  archetype: 'ambusher',
  tier: 2,
  stats: {
    maxHealth: 32,
    health: 32,
    attack: 13,
    defense: 3,
    accuracy: 70,
    evasion: 18,
    speed: 105,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'poison',
      range: 1,
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
  sprite: SPRITE_MAP['enemy:mire_toad'],
  biomes: [{ biomeId: 'forest' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'wall_lurker',
} as const satisfies EnemyTemplate;
