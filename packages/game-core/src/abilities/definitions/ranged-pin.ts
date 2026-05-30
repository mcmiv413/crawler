import { rangedPin, slow } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const RANGED_PIN_DEFINITION: AbilityDefinition = buildContentBackedDefinition(rangedPin, {
  tags: ['ranged', 'attack'],
  unlocks: [{ kind: 'mastery', weaponType: 'ranged', masteryIndex: 1 }],
  requirements: [
    { kind: 'weapon_type', weaponType: 'ranged' },
    { kind: 'has_target' },
    { kind: 'target_in_weapon_range' },
  ],
  targeting: { selector: { kind: 'single_enemy' } },
  effects: [
    {
      kind: 'attack',
      damageMultiplier: 1,
      trackMastery: true,
    },
    {
      kind: 'status',
      statusId: slow.id,
      statusName: slow.name,
      trigger: 'on_hit',
      duration: 3,
    },
  ],
});
