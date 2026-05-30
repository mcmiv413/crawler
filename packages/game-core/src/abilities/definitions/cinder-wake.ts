import { RING_SPELL_BY_ID, burn, cinderWake, panic } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellAttackEffect,
  buildRingSpellManaRequirements,
  buildRingSpellStatusEffect,
} from './ring-spell-utils.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

const cinderWakeSpell = RING_SPELL_BY_ID.get(cinderWake.id);

if (cinderWakeSpell === undefined) {
  throw new Error(`Missing ring spell definition: ${cinderWake.id}`);
}

const burnEffect = cinderWakeSpell.statusEffects?.find(
  (effect) => effect.statusId === burn.id && effect.target === 'affectedTargets',
);
const panicEffect = cinderWakeSpell.statusEffects?.find(
  (effect) => effect.statusId === panic.id && effect.target === 'affectedTargets',
);

export const CINDER_WAKE_DEFINITION: AbilityDefinition = buildContentBackedDefinition(cinderWake, {
  tags: ['ranged', 'attack'],
  unlocks: [],
  requirements: [
    ...buildRingSpellManaRequirements(cinderWakeSpell),
    { kind: 'has_direction' },
  ],
  targeting: {
    selector: {
      kind: 'line_from_player',
      range: cinderWakeSpell.range,
    },
  },
  effects: [
    buildRingSpellAttackEffect(cinderWakeSpell),
    ...(panicEffect === undefined
      ? []
      : [{
          kind: 'conditional' as const,
          when: { kind: 'target_has_status' as const, statusId: burn.id },
          then: [
            buildRingSpellStatusEffect(panicEffect, { trigger: 'always' }),
          ],
        }]),
    ...(burnEffect === undefined
      ? []
      : [buildRingSpellStatusEffect(burnEffect, { trigger: 'always' })]),
  ],
});
