import { RING_SPELL_BY_ID, burn, slow, stormfire } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellAttackEffect,
  buildRingSpellManaRequirements,
  buildRingSpellStatusEffect,
} from './ring-spell-utils.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

const stormfireSpell = RING_SPELL_BY_ID.get(stormfire.id);

if (stormfireSpell === undefined) {
  throw new Error(`Missing ring spell definition: ${stormfire.id}`);
}

const burnEffect = stormfireSpell.statusEffects?.find(
  (effect) => effect.statusId === burn.id && effect.target === 'affectedTargets',
);
const slowEffect = stormfireSpell.statusEffects?.find(
  (effect) => effect.statusId === slow.id && effect.target === 'affectedTargets',
);

export const STORMFIRE_DEFINITION: AbilityDefinition = buildContentBackedDefinition(stormfire, {
  tags: ['ranged', 'attack'],
  unlocks: [],
  requirements: [
    ...buildRingSpellManaRequirements(stormfireSpell),
    { kind: 'has_direction' },
  ],
  targeting: {
    selector: {
      kind: 'line_from_player',
      range: stormfireSpell.range,
    },
  },
  effects: [
    buildRingSpellAttackEffect(stormfireSpell),
    ...(burnEffect === undefined
      ? []
      : [buildRingSpellStatusEffect(burnEffect, { trigger: 'always' })]),
    ...(slowEffect === undefined
      ? []
      : [buildRingSpellStatusEffect(slowEffect, { trigger: 'always' })]),
  ],
});
