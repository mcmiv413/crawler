import { RING_SPELL_BY_ID } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellManaRequirements,
  buildRingSpellStatusEffect,
} from './ring-spell-utils.js';

const heatSurgeSpell = RING_SPELL_BY_ID.get('heat_surge');

if (heatSurgeSpell === undefined) {
  throw new Error('Missing ring spell definition: heat_surge');
}

export const HEAT_SURGE_DEFINITION: AbilityDefinition = {
  id: heatSurgeSpell.id,
  name: heatSurgeSpell.name,
  description: heatSurgeSpell.description,
  tags: ['self'],
  cooldown: heatSurgeSpell.cooldown,
  unlocks: [],
  requirements: [
    ...buildRingSpellManaRequirements(heatSurgeSpell),
    { kind: 'no_target' },
  ],
  targeting: { selector: { kind: 'self' } },
  effects: (heatSurgeSpell.statusEffects ?? [])
    .filter((effect) => effect.target === 'self')
    .map((effect) =>
      buildRingSpellStatusEffect(effect, {
        target: 'player',
        trigger: 'always',
      }),
    ),
};
