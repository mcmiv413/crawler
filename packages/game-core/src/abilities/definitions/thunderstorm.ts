import { RING_SPELL_BY_ID, thunderstorm, stormActive } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellManaRequirements,
  buildRingSpellStatusEffect,
} from './ring-spell-utils.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

const thunderstormSpell = RING_SPELL_BY_ID.get(thunderstorm.id);

if (thunderstormSpell === undefined) {
  throw new Error(`Missing ring spell definition: ${thunderstorm.id}`);
}

const stormEffect = thunderstormSpell.statusEffects?.find(
  (effect) => effect.statusId === stormActive.id && effect.target === 'self',
);

export const THUNDERSTORM_DEFINITION: AbilityDefinition = buildContentBackedDefinition(thunderstorm, {
  tags: ['ranged', 'attack'],
  unlocks: [],
  requirements: [
    ...buildRingSpellManaRequirements(thunderstormSpell),
    { kind: 'no_target' },
  ],
  targeting: { selector: { kind: 'self' } },
  effects: (stormEffect === undefined
    ? []
    : [
        buildRingSpellStatusEffect(stormEffect, {
          target: 'player',
          trigger: 'always',
        }),
      ]),
});
