import type { AbilityDefinition } from '../types.js';

export const RANGED_VOLLEY_DEFINITION: AbilityDefinition = {
  id: 'ranged_volley',
  name: 'Ranged Volley',
  description: 'Rain down arrows on all visible enemies for 70% damage each.',
  tags: ['ranged', 'attack'],
  cooldown: 3,
  unlocks: [{ kind: 'mastery', weaponType: 'ranged', masteryIndex: 2 }],
  requirements: [
    { kind: 'weapon_type', weaponType: 'ranged' },
  ],
  targeting: { selector: { kind: 'all_visible_enemies' } },
  effects: [
    {
      kind: 'attack',
      damageMultiplier: 0.7,
      trackMastery: true,
    },
  ],
};
