import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';

export const bludgeonShatter: AbilityDefinition = {
  id: 'bludgeon_shatter',
  name: 'Bludgeon Shatter',
  description: 'Smash through armor, permanently reducing target defense by 5.',
  cooldown: 4,
  requiresTarget: true,
  unlockLevel: 0,
  requiresWeaponTypes: ['bludgeon'],
  animation: { id: animationRefs.aoe.shatterBurst.id },
};
