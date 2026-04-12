import type { EnemyTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const briarNeedler = {
  templateId: 'briar_needler',
  name: 'Briar Needler',
  archetype: 'skittish_ranged',
  tier: 2,
  stats: {
    maxHealth: 25,
    health: 25,
    attack: 11,
    defense: 2,
    accuracy: 75,
    evasion: 20,
    speed: 110,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'poison',
      range: 2,
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
  sprite: SPRITE_MAP['enemy:briar_needler'],
  biomes: [{ biomeId: 'forest' }],
  factions: [{ factionId: 'beast_swarm', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
