import { MAGIC, STATUS_DEFAULTS } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';

export const EMBER_DEFINITION: AbilityDefinition = {
  id: 'ember',
  name: 'Ember',
  description: 'Strike one enemy with fire and apply Burn on hit.',
  tags: ['ranged', 'attack'],
  cooldown: 1,
  unlocks: [],
  requirements: [
    { kind: 'has_mana', amount: MAGIC.emberManaCost },
    { kind: 'has_target' },
    { kind: 'target_visible' },
    { kind: 'target_in_weapon_range' },
  ],
  targeting: { selector: { kind: 'single_enemy' } },
  effects: [
    {
      kind: 'attack',
      damageMultiplier: 1,
      damageType: 'fire',
      spell: true,
      forceHit: true,
      trackMastery: false,
    },
    {
      kind: 'status',
      statusId: 'burn',
      statusName: 'Burn',
      trigger: 'on_hit',
      duration: STATUS_DEFAULTS.burn.defaultDuration,
      magnitude: 1,
    },
  ],
};
