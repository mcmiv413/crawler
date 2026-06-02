import { animationRefs } from '../animation-refs/index.js';
import type { RingSpellDefinition } from './types.js';

export const thunderStep: RingSpellDefinition = {
  id: 'thunder_step',
  name: 'Thunder Step',
  description: 'Spend 12 mana to teleport to a visible tile and deal shock damage in an area around both departure and arrival.',
  cooldown: 2,
  requiresTarget: false,
  tileTarget: true,
  unlockLevel: 1,
  manaCost: 12,
  xpGainOnCast: 2,
  animation: { id: animationRefs.impact.lightningStrike.id },
  schools: ['lightning'],
  minimumSchoolLevel: 1,
  studyRequirements: [
    { kind: 'equippedSchool', school: 'lightning' },
    { kind: 'prerequisiteSpell', spellId: 'bolt' },
    { kind: 'goldCost', gold: 60 },
  ],
  effectKind: 'custom',
  effectHandlerId: 'thunder_step',
  range: 10,
  baseDamage: 5,
};
