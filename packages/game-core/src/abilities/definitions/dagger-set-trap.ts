import { daggerSetTrap } from '@dungeon/content';
import type { AbilityDefinition } from '../types.js';
import { buildContentBackedDefinition } from './content-backed-definition.js';

export const DAGGER_SET_TRAP_DEFINITION: AbilityDefinition = buildContentBackedDefinition(daggerSetTrap, {
  tags: ['self'],
  unlocks: [],
  requirements: [
    { kind: 'weapon_type', weaponType: 'dagger' },
    { kind: 'has_direction' },
  ],
  targeting: { selector: { kind: 'custom', selectorId: 'set_trap_direction' } },
  effects: [],
});
