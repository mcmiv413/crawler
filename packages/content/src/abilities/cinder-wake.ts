import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';
import { FIRE_RING_CINDER_WAKE_ID } from './utilities.js';

export const cinderWake: AbilityDefinition = {
  id: FIRE_RING_CINDER_WAKE_ID,
  name: 'Cinder Wake',
  description: 'Spend 12 mana to send cinders in a line, burning enemies and panicking burning targets.',
  cooldown: 3,
  requiresTarget: false,
  requiresDirection: true,
  unlockLevel: 2,
  manaCost: 12,
  animation: { id: animationRefs.aoe.cinderWake.id },
};
