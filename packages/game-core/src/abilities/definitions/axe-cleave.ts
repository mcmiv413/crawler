import { axeCleave } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const AXE_CLEAVE_DEFINITION: AbilityDefinition = buildContentBackedDefinition(axeCleave, {
  tags: ['melee', 'attack'],
  unlocks: [{ kind: 'mastery', weaponType: 'axe', masteryIndex: 1 }],
  requirements: [
    { kind: 'weapon_type', weaponType: 'axe' },
    { kind: 'has_target' },
    { kind: 'target_in_melee_range' },
  ],
  targeting: { selector: { kind: 'target_plus_adjacent_enemies' } },
  effects: [
    {
      kind: 'attack',
      damageMultiplier: 1.0, // Primary target at full damage; adjacent targets will be reduced to 50% by applyAttack
      trackMastery: true,
    },
  ],
});
