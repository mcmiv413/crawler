import { bludgeonShatter } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const BLUDGEON_SHATTER_DEFINITION: AbilityDefinition = buildContentBackedDefinition(bludgeonShatter, {
  tags: ['melee', 'attack'],
  unlocks: [{ kind: 'mastery', weaponType: 'bludgeon', masteryIndex: 2 }],
  requirements: [
    { kind: 'weapon_type', weaponType: 'bludgeon' },
    { kind: 'has_target' },
    { kind: 'target_in_melee_range' },
  ],
  targeting: { selector: { kind: 'single_enemy' } },
  effects: [
    {
      kind: 'attack',
      damageMultiplier: 1,
      trackMastery: true,
    },
    {
      kind: 'modify_stat',
      stat: 'defense',
      operation: 'subtract',
      amount: 5,
      trigger: 'on_hit',
      duration: 'permanent',
      minimum: 0,
    },
  ],
});
