import { animationRefs } from '../animation-refs/index.js';
import { burn } from '../statuses/index.js';
import type { RingSpellDefinition } from './types.js';

export const ember: RingSpellDefinition = {
  id: 'ember',
  name: 'Ember',
  description: 'Strike an enemy with fire, applying Burn on hit.',
  cooldown: 1,
  requiresTarget: true,
  unlockLevel: 0,
  manaCost: 5,
  animation: { id: animationRefs.projectile.emberBolt.id },
  schools: ['fire'],
  studyRequirements: [
    { kind: 'equippedSchool', school: 'fire' },
    { kind: 'goldCost', gold: 30 },
  ],
  effectKind: 'single_target_damage',
  range: 4,
  baseDamage: 8,
  statusEffects: [{ statusId: burn.id, duration: 3, target: 'target' }],
};
