import { RING_SPELL_BY_ID, thunderStep } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellManaRequirements,
} from './ring-spell-utils.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

const thunderStepSpell = RING_SPELL_BY_ID.get(thunderStep.id);

if (thunderStepSpell === undefined) {
  throw new Error(`Missing ring spell definition: ${thunderStep.id}`);
}

export const THUNDER_STEP_DEFINITION: AbilityDefinition = buildContentBackedDefinition(thunderStep, {
  tags: ['ranged', 'attack'],
  unlocks: [],
  requirements: [
    ...buildRingSpellManaRequirements(thunderStepSpell),
    { kind: 'has_tile_target' },
  ],
  targeting: { selector: { kind: 'custom', selectorId: 'thunder_step_tile' } },
  effects: [],
});
