import { animationRefs } from '../animation-refs/index.js';
import { stormActive } from '../statuses/index.js';
import type { RingSpellDefinition } from './types.js';

export const thunderstorm: RingSpellDefinition = {
  id: 'thunderstorm',
  name: 'Thunderstorm',
  description: 'Spend 20 mana to unleash a 3-turn storm that strikes 1-3 random visible enemies each turn with shock, Burn, and Stun.',
  cooldown: 5,
  requiresTarget: false,
  unlockLevel: 4,
  manaCost: 20,
  xpGainOnCast: 3,
  animation: { id: animationRefs.impact.radialImpactBurst.id },
  schools: ['fire', 'lightning'],
  minimumSchoolLevel: 4,
  studyRequirements: [
    { kind: 'equippedSchool', school: 'fire' },
    { kind: 'equippedSchool', school: 'lightning' },
    { kind: 'goldCost', gold: 150 },
    { kind: 'prerequisiteSpell', spellId: 'stormfire' },
  ],
  effectKind: 'self_buff',
  range: 0,
  statusEffects: [
    { statusId: stormActive.id, duration: 3, target: 'self' },
  ],
};
