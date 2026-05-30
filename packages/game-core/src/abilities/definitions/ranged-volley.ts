import { rangedVolley } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const RANGED_VOLLEY_DEFINITION: AbilityDefinition = buildContentBackedDefinition(rangedVolley, {
  tags: ['ranged', 'attack'],
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
});
