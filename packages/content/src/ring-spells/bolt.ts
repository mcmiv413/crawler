import { animationRefs } from '../animation-refs/index.js';
import type { RingSpellDefinition } from './types.js';

export const bolt: RingSpellDefinition = {
  id: 'bolt',
  name: 'Bolt',
  description: 'Spend 7 mana to strike an enemy up to 4 tiles away with lightning.',
  cooldown: 1,
  requiresTarget: true,
  unlockLevel: 0,
  manaCost: 7,
  xpGainOnCast: 2,
  animation: { id: animationRefs.projectile.lightningBolt.id },
  schools: ['lightning'],
  studyRequirements: [
    { kind: 'equippedSchool', school: 'lightning' },
    { kind: 'goldCost', gold: 30 },
  ],
  effectKind: 'single_target_damage',
  range: 4,
  baseDamage: 8,
};
