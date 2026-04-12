import type { ArchetypeDefinition } from '@dungeon/contracts';

export const HAZARD_CREATOR = {
  id: 'hazard_creator',
  name: 'Hazard Creator',
  description: 'Sets traps and creates hazards, avoids direct combat.',

  targetSelection: [],

  positioning: [
    { factor: 'rangeToPlayer', targetDistance: 3, weight: 2 },
  ],

  actionSelection: [
    {
      condition: 'playerRange2to4',
      actions: ['ability'],
      weight: 3,
    },
    {
      condition: 'playerAdjacent',
      actions: ['move'],
      weight: 3,
    },
  ],

  abilityPreferences: [
    { abilityId: 'flame_trail', weight: 3, usageHp: 'anytime' },
    { abilityId: 'fire_bolt', weight: 2, usageHp: 'anytime' },
  ],
} as const satisfies ArchetypeDefinition;
