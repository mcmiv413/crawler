import { powerStrike } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const POWER_STRIKE_DEFINITION: AbilityDefinition = buildContentBackedDefinition(powerStrike, {
  tags: ['melee', 'attack'],
  unlocks: [{ kind: 'level', minLevel: 2 }],
  requirements: [
    { kind: 'has_target' },
    { kind: 'target_in_melee_range' },
  ],
  targeting: { selector: { kind: 'single_enemy' } },
  effects: [
    {
      kind: 'attack',
      damageMultiplier: 2,
      trackMastery: false,
    },
  ],
});
