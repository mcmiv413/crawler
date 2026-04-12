import type { ArchetypeDefinition } from '@dungeon/contracts';

export const AGGRESSIVE_MELEE = {
  id: 'aggressive_melee',
  name: 'Aggressive Melee',
  description: 'Charges the player, attacks relentlessly, enrages when hurt.',

  targetSelection: [
    { factor: 'proximity', weight: 2, direction: 'minimize' },
  ],

  positioning: [
    { factor: 'rangeToPlayer', targetDistance: 1, weight: 3 },
  ],

  actionSelection: [
    {
      condition: 'playerAdjacent',
      actions: ['attack', 'ability'],
      weight: 4,
    },
    {
      condition: 'playerRange2to5',
      actions: ['move'],
      weight: 2,
    },
    {
      condition: 'hpBelowThreshold(0.25)',
      actions: ['attack', 'ability'],
      weight: 5,
    },
  ],

  panicThresholds: [
    { hpPercent: 25, behavior: 'enrage' },
  ],

  abilityPreferences: [
    { abilityId: 'crushing_blow', weight: 3, usageHp: 'critical' },
  ],
} as const satisfies ArchetypeDefinition;
