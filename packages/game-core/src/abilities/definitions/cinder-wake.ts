import { RING_SPELL_BY_ID } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellAttackEffect,
  buildRingSpellManaRequirements,
  buildRingSpellStatusEffect,
} from './ring-spell-utils.js';

const cinderWakeSpell = RING_SPELL_BY_ID.get('cinder_wake');

if (cinderWakeSpell === undefined) {
  throw new Error('Missing ring spell definition: cinder_wake');
}

const burnEffect = cinderWakeSpell.statusEffects?.find(
  (effect) => effect.statusId === 'burn' && effect.target === 'affectedTargets',
);
const panicEffect = cinderWakeSpell.statusEffects?.find(
  (effect) => effect.statusId === 'panic' && effect.target === 'affectedTargets',
);

export const CINDER_WAKE_DEFINITION: AbilityDefinition = {
  id: cinderWakeSpell.id,
  name: cinderWakeSpell.name,
  description: cinderWakeSpell.description,
  tags: ['ranged', 'attack'],
  cooldown: cinderWakeSpell.cooldown,
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
          when: { kind: 'target_has_status' as const, statusId: 'burn' },
          then: [
            buildRingSpellStatusEffect(panicEffect, { trigger: 'always' }),
          ],
        }]),
    ...(burnEffect === undefined
      ? []
      : [buildRingSpellStatusEffect(burnEffect, { trigger: 'always' })]),
  ],
};
