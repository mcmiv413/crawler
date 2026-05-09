import type { AbilityDefinition } from './types.js';

export const bladeRiposte: AbilityDefinition = {
  id: 'blade_riposte',
  name: 'Blade Riposte',
  description: 'A guaranteed critical strike with +50% accuracy bonus.',
  cooldown: 3,
  requiresTarget: true,
  unlockLevel: 0,
  requiresWeaponTypes: ['blade'],
  animation: { id: 'fx.impact.riposte-glint' },
};
