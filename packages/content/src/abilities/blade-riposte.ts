import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';

export const bladeRiposte: AbilityDefinition = {
  id: 'blade_riposte',
  name: 'Blade Riposte',
  description: 'A guaranteed critical strike with +50% accuracy bonus.',
  cooldown: 3,
  requiresTarget: true,
  unlockLevel: 0,
  requiresWeaponTypes: ['blade'],
  animation: { id: animationRefs.impact.riposteGlint.id },
};
