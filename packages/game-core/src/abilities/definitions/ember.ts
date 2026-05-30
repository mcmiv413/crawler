import { RING_SPELL_BY_ID } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import {
  buildRingSpellAttackEffect,
  buildRingSpellManaRequirements,
  buildRingSpellStatusEffect,
} from './ring-spell-utils.js';

const emberSpell = RING_SPELL_BY_ID.get('ember');

if (emberSpell === undefined) {
  throw new Error('Missing ring spell definition: ember');
}

export const EMBER_DEFINITION: AbilityDefinition = {
  id: emberSpell.id,
  name: emberSpell.name,
  description: emberSpell.description,
  tags: ['ranged', 'attack'],
  cooldown: emberSpell.cooldown,
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
};
