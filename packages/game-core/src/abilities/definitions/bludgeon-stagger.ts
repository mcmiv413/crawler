import { bludgeonStagger, stun } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const BLUDGEON_STAGGER_DEFINITION: AbilityDefinition = buildContentBackedDefinition(bludgeonStagger, {
  tags: ['melee', 'attack'],
  unlocks: [{ kind: 'mastery', weaponType: 'bludgeon', masteryIndex: 1 }],
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
      kind: 'status',
      statusId: stun.id,
      statusName: stun.name,
      trigger: 'on_hit',
      chance: 0.8,
      duration: 1,
    },
  ],
});
