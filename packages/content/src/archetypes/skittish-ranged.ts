import type { ArchetypeDefinition } from '@dungeon/contracts';

export const SKITTISH_RANGED = {
  id: 'skittish_ranged',
  name: 'Skittish Ranged',
  description: 'Maintains distance, fires from afar, retreats when threatened.',

  targetSelection: [
    { factor: 'proximity', weight: -1, direction: 'maximize' },
  ],

  positioning: [
    { factor: 'rangeToPlayer', targetDistance: 3, weight: 2 },
  ],

  actionSelection: [
    {
      condition: 'playerAdjacent',
      actions: ['move'],
      weight: 4,
    },
    {
      condition: 'playerRange2to5',
      actions: ['wait'],
      weight: 3,
    },
    {
      condition: 'playerRange6Plus',
      actions: ['move'],
      weight: 2,
    },
    {
      condition: 'hpBelowThreshold(0.30)',
      actions: ['move'],
      weight: 5,
    },
  ],

  panicThresholds: [
    { hpPercent: 30, behavior: 'retreat' },
  ],

  abilityPreferences: [
    { abilityId: 'fire_bolt', weight: 2, usageHp: 'anytime' },
  ],
} as const satisfies ArchetypeDefinition;
