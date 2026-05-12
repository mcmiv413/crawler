import type { AbilityDefinition } from './types.js';
import { animationRefs } from '../animation-refs/index.js';

export const secondWind: AbilityDefinition = {
  id: 'second_wind',
  name: 'Second Wind',
  description: 'Catch your breath, restoring 25% of your maximum HP.',
  cooldown: 4,
  requiresTarget: false,
  unlockLevel: 4,
  animation: { id: animationRefs.self.secondWindBuff.id },
};
