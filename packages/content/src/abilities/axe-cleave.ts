import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';

export const axeCleave: AbilityDefinition = {
  id: 'axe_cleave',
  name: 'Axe Cleave',
  description: 'Strike primary target and all adjacent enemies at 50% damage.',
  cooldown: 2,
  requiresTarget: true,
  unlockLevel: 0,
  requiresWeaponTypes: ['axe'],
  animation: { id: animationRefs.aoe.cleaveArc.id },
};
