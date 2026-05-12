import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';

export const daggerDisarm: AbilityDefinition = {
  id: 'dagger_disarm',
  name: 'Disarm Trap',
  description: 'Remove an adjacent trap and add it to your inventory.',
  cooldown: 0,
  requiresTarget: false,
  unlockLevel: 0,
  requiresWeaponTypes: ['dagger'],
  animation: { id: animationRefs.impact.disarmStrike.id },
};
