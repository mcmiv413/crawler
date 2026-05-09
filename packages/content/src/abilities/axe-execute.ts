import type { AbilityDefinition } from './types.js';

export const axeExecute: AbilityDefinition = {
  id: 'axe_execute',
  name: 'Axe Execute',
  description: 'Deal 3× damage to enemies below 30% HP.',
  cooldown: 3,
  requiresTarget: true,
  unlockLevel: 0,
  requiresWeaponTypes: ['axe'],
  animation: { id: 'fx.impact.execution-strike' },
};
