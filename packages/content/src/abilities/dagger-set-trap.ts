import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';

export const daggerSetTrap: AbilityDefinition = {
  id: 'dagger_set_trap',
  name: 'Set Trap',
  description: 'Place a trap on an adjacent empty tile.',
  cooldown: 0,
  requiresTarget: false,
  unlockLevel: 0,
  requiresWeaponTypes: ['dagger'],
  animation: { id: animationRefs.utility.trapPlacement.id },
};
