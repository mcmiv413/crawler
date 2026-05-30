import { RING_SPELL_BY_ID, ember } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellAttackEffect,
  buildRingSpellManaRequirements,
  buildRingSpellStatusEffect,
} from './ring-spell-utils.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

const emberSpell = RING_SPELL_BY_ID.get(ember.id);

if (emberSpell === undefined) {
  throw new Error(`Missing ring spell definition: ${ember.id}`);
}

export const EMBER_DEFINITION: AbilityDefinition = buildContentBackedDefinition(ember, {
  tags: ['ranged', 'attack'],
  unlocks: [],
  requirements: [
    ...buildRingSpellManaRequirements(emberSpell),
    { kind: 'has_target' },
    { kind: 'target_visible' },
    { kind: 'target_in_ability_range', range: emberSpell.range },
  ],
  targeting: { selector: { kind: 'single_enemy' } },
  effects: [
    buildRingSpellAttackEffect(emberSpell),
    ...(emberSpell.statusEffects ?? [])
      .filter((effect) => effect.target === 'target')
      .map((effect) =>
        buildRingSpellStatusEffect(effect, { trigger: 'on_hit' }),
      ),
  ],
});
