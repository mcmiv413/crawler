import type { EnemyTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const goblinArcher = {
  templateId: 'goblin_archer',
  name: 'Goblin Archer',
  archetype: 'skittish_ranged',
  tier: 1,
  stats: {
    maxHealth: 20,
    health: 20,
    attack: 10,
    defense: 2,
    accuracy: 75,
    evasion: 15,
    speed: 100,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'physical',
      range: 3,
    },
  },
  affinities: {},
  spawn: {
    floorRange: [1, 2],
    weight: 2,
  },
  lootTableId: 'loot_goblin',
  experienceValue: 12,
  description: 'A sneaky goblin with a short bow.',
  ascii: 'g',
  color: '#66aa55',
  movementBehaviorId: 'rearline_anchor',
  sprite: SPRITE_MAP['enemy:goblin_archer'],
  biomes: [{ biomeId: 'goblin_warrens' }],
  factions: [{ factionId: 'goblin_warband', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
