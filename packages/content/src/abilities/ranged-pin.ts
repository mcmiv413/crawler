import type { AbilityDefinition } from './types.js';

export const rangedPin: AbilityDefinition = {
  id: 'ranged_pin',
  name: 'Ranged Pin',
  description: 'Attack that roots the target in place (slow, 3 turns).',
  cooldown: 2,
  requiresTarget: true,
  unlockLevel: 0,
  requiresWeaponTypes: ['ranged'],
  animation: { id: 'fx.projectile.single-arrow' },
};
