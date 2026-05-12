import { MAGIC, STATUS_DEFAULTS } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';

export const HEAT_SURGE_DEFINITION: AbilityDefinition = {
  id: 'heat_surge',
  name: 'Heat Surge',
  description: 'For a short time, your attacks and offensive spells apply Burn.',
  tags: ['self'],
  cooldown: 2,
  unlocks: [],
  requirements: [
    { kind: 'has_mana', amount: MAGIC.heatSurgeManaCost },
    { kind: 'no_target' },
  ],
  targeting: { selector: { kind: 'self' } },
  effects: [
    {
      kind: 'status',
      target: 'player',
      statusId: 'heat_surge',
      statusName: 'Heat Surge',
      trigger: 'always',
      duration: STATUS_DEFAULTS.heat_surge.defaultDuration,
      magnitude: 1,
    },
  ],
};
