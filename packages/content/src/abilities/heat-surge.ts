import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';

export const heatSurge: AbilityDefinition = {
  id: 'heat_surge',
  name: 'Heat Surge',
  description: 'Spend 11 mana to make your attacks and offensive spells apply Burn.',
  cooldown: 2,
  requiresTarget: false,
  unlockLevel: 1,
  manaCost: 11,
  animation: { id: animationRefs.self.heatSurgeAura.id },
};
