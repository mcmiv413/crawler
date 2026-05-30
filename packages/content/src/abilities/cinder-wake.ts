import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';

export const cinderWake: AbilityDefinition = {
  id: 'cinder_wake',
  name: 'Cinder Wake',
  description: 'Spend 12 mana to send cinders in a line, burning enemies and panicking burning targets.',
  cooldown: 3,
  requiresTarget: false,
  requiresDirection: true,
  unlockLevel: 2,
  manaCost: 12,
  animation: { id: animationRefs.aoe.cinderWake.id },
};
