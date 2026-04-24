import type { AbilityDefinition } from './types.js';

export const powerStrike: AbilityDefinition = {
  id: 'power_strike',
  name: 'Power Strike',
  description: 'Unleash a devastating blow dealing 2× your attack damage.',
  cooldown: 2,
  requiresTarget: true,
  unlockLevel: 2,
  requiresWeaponTypes: ['blade', 'bludgeon', 'axe'],
};
