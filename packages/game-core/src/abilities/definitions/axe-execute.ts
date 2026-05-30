import { axeExecute } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const AXE_EXECUTE_DEFINITION: AbilityDefinition = buildContentBackedDefinition(axeExecute, {
  tags: ['melee', 'attack'],
  unlocks: [{ kind: 'mastery', weaponType: 'axe', masteryIndex: 2 }],
  requirements: [
    { kind: 'weapon_type', weaponType: 'axe' },
    { kind: 'has_target' },
    { kind: 'target_in_melee_range' },
  ],
  targeting: { selector: { kind: 'single_enemy' } },
  effects: [
    {
      kind: 'conditional',
      when: { kind: 'target_below_hp_pct', percentage: 0.3 },
      then: [
        {
          kind: 'attack',
          damageMultiplier: 3,
          trackMastery: true,
        },
      ],
      otherwise: [
        {
          kind: 'attack',
          damageMultiplier: 1,
          trackMastery: true,
        },
      ],
    },
  ],
});
