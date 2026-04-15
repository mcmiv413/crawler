import type { AbilityDefinition } from '../types.js';

export const AXE_EXECUTE_DEFINITION: AbilityDefinition = {
  id: 'axe_execute',
  name: 'Axe Execute',
  description: 'Deal 3× damage to enemies below 30% HP.',
  tags: ['melee', 'attack'],
  cooldown: 3,
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
};
