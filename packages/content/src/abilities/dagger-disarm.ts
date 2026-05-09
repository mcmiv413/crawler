import type { AbilityDefinition } from './types.js';

export const daggerDisarm: AbilityDefinition = {
  id: 'dagger_disarm',
  name: 'Disarm Trap',
  description: 'Remove an adjacent trap and add it to your inventory.',
  cooldown: 0,
  requiresTarget: false,
  unlockLevel: 0,
  requiresWeaponTypes: ['dagger'],
  animation: { id: 'fx.impact.disarm-strike' },
};
