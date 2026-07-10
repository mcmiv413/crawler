import { daggerDisarm } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const DAGGER_DISARM_DEFINITION: AbilityDefinition = buildContentBackedDefinition(daggerDisarm, {
  tags: ['self'],
  unlocks: [],
  requirements: [
    { kind: 'weapon_type', weaponType: 'dagger' },
    { kind: 'has_direction' },
  ],
  targeting: { selector: { kind: 'custom', selectorId: 'disarm_trap_direction' } },
  effects: [],
});
