import { RING_SPELL_BY_ID, plasmaArc } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellAttackEffect,
  buildRingSpellManaRequirements,
  buildRingSpellStatusEffect,
} from './ring-spell-utils.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

const plasmaArcSpell = RING_SPELL_BY_ID.get(plasmaArc.id);

if (plasmaArcSpell === undefined) {
  throw new Error(`Missing ring spell definition: ${plasmaArc.id}`);
}

export const PLASMA_ARC_DEFINITION: AbilityDefinition = buildContentBackedDefinition(plasmaArc, {
  tags: ['ranged', 'attack'],
  unlocks: [],
  requirements: [
    ...buildRingSpellManaRequirements(plasmaArcSpell),
    { kind: 'has_target' },
    { kind: 'target_visible' },
    { kind: 'target_in_ability_range', range: plasmaArcSpell.range },
  ],
  targeting: { selector: { kind: 'single_enemy' } },
  effects: [
    buildRingSpellAttackEffect(plasmaArcSpell),
    ...(plasmaArcSpell.statusEffects ?? [])
      .filter((effect) => effect.target === 'target')
      .map((effect) =>
        buildRingSpellStatusEffect(effect, { trigger: 'on_hit' }),
      ),
  ],
});
