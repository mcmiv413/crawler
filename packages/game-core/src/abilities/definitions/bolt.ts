import { RING_SPELL_BY_ID, bolt } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellAttackEffect,
  buildRingSpellManaRequirements,
} from './ring-spell-utils.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

const boltSpell = RING_SPELL_BY_ID.get(bolt.id);

if (boltSpell === undefined) {
  throw new Error(`Missing ring spell definition: ${bolt.id}`);
}

export const BOLT_DEFINITION: AbilityDefinition = buildContentBackedDefinition(bolt, {
  tags: ['ranged', 'attack'],
  unlocks: [],
  requirements: [
    ...buildRingSpellManaRequirements(boltSpell),
    { kind: 'has_target' },
    { kind: 'target_visible' },
    { kind: 'target_in_ability_range', range: boltSpell.range },
  ],
  targeting: { selector: { kind: 'single_enemy' } },
  effects: [buildRingSpellAttackEffect(boltSpell)],
});
