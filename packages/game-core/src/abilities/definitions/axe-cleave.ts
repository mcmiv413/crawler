import type { AbilityDefinition } from '../types.js';

export const AXE_CLEAVE_DEFINITION: AbilityDefinition = {
  id: 'axe_cleave',
  name: 'Axe Cleave',
  description: 'Strike primary target and all adjacent enemies at 50% damage.',
  tags: ['melee', 'attack'],
  cooldown: 2,
  unlocks: [{ kind: 'mastery', weaponType: 'axe', masteryIndex: 1 }],
  requirements: [
    { kind: 'weapon_type', weaponType: 'axe' },
    { kind: 'has_target' },
  ],
  targeting: { selector: { kind: 'target_plus_adjacent_enemies' } },
  effects: [
    {
      kind: 'attack',
      damageMultiplier: 0.75, // Average of 1x primary and 0.5x adjacent
      trackMastery: true,
    },
  ],
};
