import { RING_SPELL_BY_ID, rollingThunder } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellAttackEffect,
  buildRingSpellManaRequirements,
} from './ring-spell-utils.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

const rollingThunderSpell = RING_SPELL_BY_ID.get(rollingThunder.id);

if (rollingThunderSpell === undefined) {
  throw new Error(`Missing ring spell definition: ${rollingThunder.id}`);
}

export const ROLLING_THUNDER_DEFINITION: AbilityDefinition = buildContentBackedDefinition(rollingThunder, {
  tags: ['ranged', 'attack'],
  unlocks: [],
  requirements: [
    ...buildRingSpellManaRequirements(rollingThunderSpell),
    { kind: 'has_direction' },
  ],
  targeting: {
    selector: {
      kind: 'line_from_player',
      range: rollingThunderSpell.range,
    },
  },
  effects: [buildRingSpellAttackEffect(rollingThunderSpell)],
});
