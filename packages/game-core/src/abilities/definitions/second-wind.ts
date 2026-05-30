import { secondWind } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const SECOND_WIND_DEFINITION: AbilityDefinition = buildContentBackedDefinition(secondWind, {
  tags: ['heal', 'self'],
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
});
