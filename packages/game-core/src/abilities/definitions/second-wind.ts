import type { AbilityDefinition } from '../types.js';

export const SECOND_WIND_DEFINITION: AbilityDefinition = {
  id: 'second_wind',
  name: 'Second Wind',
  description: 'Catch your breath, restoring 25% of your maximum HP.',
  tags: ['heal', 'self'],
  cooldown: 4,
  unlocks: [{ kind: 'level', minLevel: 4 }],
  requirements: [
    { kind: 'no_target' },
  ],
  targeting: { selector: { kind: 'self' } },
  effects: [
    {
      kind: 'heal',
      percentageOfMaxHealth: 0.25,
    },
  ],
};
