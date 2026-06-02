import { animationRefs } from '../animation-refs/index.js';
import { burn, panic } from '../statuses/index.js';
import type { RingSpellDefinition } from './types.js';

export const cinderWake: RingSpellDefinition = {
  id: 'cinder_wake',
  name: 'Cinder Wake',
  description: 'Spend 15 mana to send cinders in a line, burning enemies and panicking burning targets.',
  cooldown: 3,
  requiresTarget: false,
  requiresDirection: true,
  unlockLevel: 2,
  manaCost: 15,
  xpGainOnCast: 3,
  animation: { id: animationRefs.aoe.cinderWake.id },
  schools: ['fire'],
  minimumSchoolLevel: 2,
  studyRequirements: [
    { kind: 'equippedSchool', school: 'fire' },
    { kind: 'goldCost', gold: 100 },
  ],
  effectKind: 'line_damage',
  range: 5,
  baseDamage: 6,
  statusEffects: [
    { statusId: burn.id, duration: 4, target: 'affectedTargets' },
    { statusId: panic.id, duration: 2, target: 'affectedTargets' },
  ],
};
