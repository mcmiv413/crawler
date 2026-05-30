import { RING_SPELL_BY_ID, heatSurge } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellManaRequirements,
  buildRingSpellStatusEffect,
} from './ring-spell-utils.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

const heatSurgeSpell = RING_SPELL_BY_ID.get(heatSurge.id);

if (heatSurgeSpell === undefined) {
  throw new Error(`Missing ring spell definition: ${heatSurge.id}`);
}

export const HEAT_SURGE_DEFINITION: AbilityDefinition = buildContentBackedDefinition(heatSurge, {
  tags: ['self'],
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
});
