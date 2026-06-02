import { animationRefs } from '../animation-refs/index.js';
import { burn } from '../statuses/index.js';
import type { RingSpellDefinition } from './types.js';

export const ember: RingSpellDefinition = {
  id: 'ember',
  name: 'Ember',
  description: 'Spend 7 mana to strike an enemy up to 4 tiles away with fire and apply Burn on hit.',
  cooldown: 1,
  requiresTarget: true,
  unlockLevel: 0,
  manaCost: 7,
  xpGainOnCast: 100,
  animation: { id: animationRefs.projectile.emberBolt.id },
  schools: ['fire'],
  studyRequirements: [
    { kind: 'equippedSchool', school: 'fire' },
    { kind: 'goldCost', gold: 1 }, //30
  ],
  effectKind: 'single_target_damage',
  range: 4,
  baseDamage: 8,
  statusEffects: [{ statusId: burn.id, duration: 3, target: 'target' }],
};
