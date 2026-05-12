import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';
import { FIRE_RING_HEAT_SURGE_ID } from './utilities.js';

export const heatSurge: AbilityDefinition = {
  id: FIRE_RING_HEAT_SURGE_ID,
  name: 'Heat Surge',
  description: 'Spend 8 mana to make your attacks and offensive spells apply Burn.',
  cooldown: 2,
  requiresTarget: false,
  unlockLevel: 1,
  manaCost: 8,
  animation: { id: animationRefs.self.heatSurgeAura.id },
};
