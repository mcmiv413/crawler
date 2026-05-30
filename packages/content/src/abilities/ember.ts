import { animationRefs } from '../animation-refs/index.js';
import type { AbilityDefinition } from './types.js';

export const ember: AbilityDefinition = {
  id: 'ember',
  name: 'Ember',
  description: 'Spend 5 mana to strike an enemy up to 4 tiles away with fire and apply Burn on hit.',
  cooldown: 1,
  requiresTarget: true,
  unlockLevel: 0,
  manaCost: 5,
  range: 4,
  animation: { id: animationRefs.projectile.emberBolt.id },
};
