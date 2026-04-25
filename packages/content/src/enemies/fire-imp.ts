import type { EnemyTemplate } from '@dungeon/contracts';

export const fireImp = {
  templateId: 'fire_imp',
  name: 'Fire Imp',
  archetype: 'hazard_creator',
  tier: 2,
  stats: {
    maxHealth: 18,
    health: 18,
    attack: 7,
    defense: 1,
    accuracy: 6,
    evasion: 8,
    speed: 108,
  },
  equipment: {
    weapon: {
      damageMultiplier: 1.0,
      damageType: 'fire',
      range: 2,
    },
  },
  affinities: { fire: 0.8, frost: -0.5 },
  spawn: {
    floorRange: [2, 5],
    weight: 2,
  },
  lootTableId: 'loot_elemental',
  experienceValue: 20,
  description: 'A small, cackling demon wreathed in flame.',
  ascii: 'i',
  color: '#ff6644',
  spriteName: 'imp',
  biomes: [{ biomeId: 'goblin_warrens' }],
  factions: [{ factionId: 'shadow_cult', weight: 1.0 }],
  ambientBehaviorProfile: 'wanderer',
} as const satisfies EnemyTemplate;
