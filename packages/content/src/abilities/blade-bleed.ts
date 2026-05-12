import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';

export const bladeBleed: AbilityDefinition = {
  id: 'blade_bleed',
  name: 'Blade Bleed',
  description: 'A precise strike that guarantees bleeding (2 dmg/turn, 4 turns).',
  cooldown: 2,
  requiresTarget: true,
  unlockLevel: 0,
  requiresWeaponTypes: ['blade'],
  animation: { id: animationRefs.impact.bleedingStrike.id },
};
