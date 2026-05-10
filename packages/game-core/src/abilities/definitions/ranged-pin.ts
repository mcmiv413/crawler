import type { AbilityDefinition } from '../types.js';

export const RANGED_PIN_DEFINITION: AbilityDefinition = {
  id: 'ranged_pin',
  name: 'Ranged Pin',
  description: 'Attack that roots the target in place (slow, 3 turns).',
  tags: ['ranged', 'attack'],
  cooldown: 2,
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
      statusId: 'slow',
      statusName: 'Slow',
      trigger: 'on_hit',
      duration: 3,
    },
  ],
};
