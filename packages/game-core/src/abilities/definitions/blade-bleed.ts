import { bladeBleed, bleed } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const BLADE_BLEED_DEFINITION: AbilityDefinition = buildContentBackedDefinition(bladeBleed, {
  tags: ['melee', 'attack'],
  unlocks: [{ kind: 'mastery', weaponType: 'blade', masteryIndex: 1 }],
  requirements: [
    { kind: 'weapon_type', weaponType: 'blade' },
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
      kind: 'status',
      statusId: bleed.id,
      statusName: bleed.name,
      trigger: 'on_hit',
      duration: 4,
    },
  ],
});
