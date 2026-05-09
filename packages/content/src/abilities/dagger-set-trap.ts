import type { AbilityDefinition } from './types.js';

export const daggerSetTrap: AbilityDefinition = {
  id: 'dagger_set_trap',
  name: 'Set Trap',
  description: 'Place a trap on an adjacent empty tile.',
  cooldown: 0,
  requiresTarget: false,
  unlockLevel: 0,
  requiresWeaponTypes: ['dagger'],
  animation: { id: 'fx.utility.trap-placement' },
};
