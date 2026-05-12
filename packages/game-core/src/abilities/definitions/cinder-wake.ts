import { MAGIC, STATUS_DEFAULTS } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';

export const CINDER_WAKE_DEFINITION: AbilityDefinition = {
  id: 'cinder_wake',
  name: 'Cinder Wake',
  description: 'Send cinders in a line, burning enemies and panicking targets already on fire.',
  tags: ['ranged', 'attack'],
  cooldown: 3,
  unlocks: [],
  requirements: [
    { kind: 'has_mana', amount: MAGIC.cinderWakeManaCost },
    { kind: 'has_direction' },
  ],
  targeting: { selector: { kind: 'line_from_player', range: MAGIC.cinderWakeRange } },
  effects: [
    {
      kind: 'conditional',
      when: { kind: 'target_has_status', statusId: 'burn' },
      then: [{
        kind: 'status',
        statusId: 'panic',
        statusName: 'Panic',
        trigger: 'always',
        duration: STATUS_DEFAULTS.panic.defaultDuration,
        magnitude: 1,
      }],
    },
    {
      kind: 'status',
      statusId: 'burn',
      statusName: 'Burn',
      trigger: 'always',
      duration: STATUS_DEFAULTS.burn.defaultDuration,
      magnitude: 1,
    },
  ],
};
