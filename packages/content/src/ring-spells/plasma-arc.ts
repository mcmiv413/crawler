import { animationRefs } from '../animation-refs/index.js';
import { burn } from '../statuses/index.js';
import type { RingSpellDefinition } from './types.js';

export const plasmaArc: RingSpellDefinition = {
  id: 'plasma_arc',
  name: 'Plasma Arc',
  description: 'Spend 12 mana to strike an enemy with fire and lightning, applying Burn.',
  cooldown: 2,
  requiresTarget: true,
  unlockLevel: 1,
  manaCost: 12,
  xpGainOnCast: 2,
  animation: { id: animationRefs.projectile.emberBolt.id },
  schools: ['fire', 'lightning'],
  minimumSchoolLevel: 1,
  studyRequirements: [
    { kind: 'equippedSchool', school: 'fire' },
    { kind: 'equippedSchool', school: 'lightning' },
    { kind: 'goldCost', gold: 80 },
  ],
  effectKind: 'single_target_damage',
  range: 5,
  baseDamage: 12,
  statusEffects: [{ statusId: burn.id, duration: 3, target: 'target' }],
};
