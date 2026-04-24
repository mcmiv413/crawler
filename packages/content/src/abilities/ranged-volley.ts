import type { AbilityDefinition } from './types.js';

export const rangedVolley: AbilityDefinition = {
  id: 'ranged_volley',
  name: 'Ranged Volley',
  description: 'Unleash arrows at all visible enemies for 70% attack damage.',
  cooldown: 4,
  requiresTarget: false,
  unlockLevel: 0,
  requiresWeaponTypes: ['ranged'],
};
