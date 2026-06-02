import { animationRefs } from '../animation-refs/index.js';
import type { RingSpellDefinition } from './types.js';

export const rollingThunder: RingSpellDefinition = {
  id: 'rolling_thunder',
  name: 'Rolling Thunder',
  description: 'Spend 18 mana to send a line of lightning, striking all enemies in its path.',
  cooldown: 3,
  requiresTarget: false,
  requiresDirection: true,
  unlockLevel: 3,
  manaCost: 18,
  xpGainOnCast: 3,
  animation: { id: animationRefs.impact.lightningStrike.id },
  schools: ['lightning'],
  minimumSchoolLevel: 2,
  studyRequirements: [
    { kind: 'equippedSchool', school: 'lightning' },
    { kind: 'prerequisiteSpell', spellId: 'thunder_step' },
    { kind: 'goldCost', gold: 100 },
  ],
  effectKind: 'line_damage',
  range: 5,
  baseDamage: 7,
};
