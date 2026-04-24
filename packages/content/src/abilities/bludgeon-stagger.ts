import type { AbilityDefinition } from './types.js';

export const bludgeonStagger: AbilityDefinition = {
  id: 'bludgeon_stagger',
  name: 'Bludgeon Stagger',
  description: 'A heavy blow with 80% chance to stun (enemy skips next turn).',
  cooldown: 2,
  requiresTarget: true,
  unlockLevel: 0,
  requiresWeaponTypes: ['bludgeon'],
};
