import type { ArchetypeDefinition } from '@dungeon/contracts';

export const CAUTIOUS_DEFENSIVE = {
  id: 'cautious_defensive',
  name: 'Cautious Defensive',
  description: 'Holds position, buffs allies, uses AOE to control space.',

  targetSelection: [
    { factor: 'currentHealth', weight: 1, direction: 'minimize' },
  ],

  positioning: [
    { factor: 'rangeToPlayer', targetDistance: 3, weight: 2 },
    { factor: 'groupCohesion', targetDistance: 2, weight: 1 },
  ],

  actionSelection: [
    {
      condition: 'playerAdjacent',
      actions: ['attack'],
      weight: 2,
    },
    {
      condition: 'hpBelowThreshold(0.40)',
      actions: ['move'],
      weight: 3,
    },
    {
      condition: 'hpAboveThreshold(0.60)',
      actions: ['ability', 'wait'],
      weight: 2,
    },
  ],

  panicThresholds: [
    { hpPercent: 40, behavior: 'retreat' },
  ],

  abilityPreferences: [
    { abilityId: 'chilling_aura', weight: 2, usageHp: 'anytime' },
    { abilityId: 'roar', weight: 2, usageHp: 'healthy' },
  ],
} as const satisfies ArchetypeDefinition;

export const cautiousDefensive = CAUTIOUS_DEFENSIVE;
