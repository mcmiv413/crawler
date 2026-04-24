import type { ArchetypeDefinition } from '@dungeon/contracts';

export const AMBUSHER = {
  id: 'ambusher',
  name: 'Ambusher',
  description: 'Waits concealed, strikes from shadow when player is close.',

  targetSelection: [],

  positioning: [],

  actionSelection: [
    {
      condition: 'playerNotAlerted',
      actions: ['wait'],
      weight: 5,
    },
    {
      condition: 'playerAdjacent',
      actions: ['attack', 'ability'],
      weight: 4,
    },
    {
      condition: 'playerRange2to3',
      actions: ['move'],
      weight: 2,
    },
  ],

  abilityPreferences: [
    { abilityId: 'ambush', weight: 3, usageHp: 'anytime' },
  ],
} as const satisfies ArchetypeDefinition;

export const ambusher = AMBUSHER;
