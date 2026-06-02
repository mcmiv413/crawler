import { animationRefs } from '../animation-refs/index.js';
import { burn, slow } from '../statuses/index.js';
import type { RingSpellDefinition } from './types.js';

export const stormfire: RingSpellDefinition = {
  id: 'stormfire',
  name: 'Stormfire',
  description: 'Spend 14 mana to strike enemies in a line with fire and lightning, applying Burn and Slow.',
  cooldown: 3,
  requiresTarget: false,
  requiresDirection: true,
  unlockLevel: 2,
  manaCost: 14,
  xpGainOnCast: 2,
  animation: { id: animationRefs.aoe.cinderWake.id },
  schools: ['fire', 'lightning'],
  minimumSchoolLevel: 2,
  studyRequirements: [
    { kind: 'equippedSchool', school: 'fire' },
    { kind: 'equippedSchool', school: 'lightning' },
    { kind: 'goldCost', gold: 120 },
    { kind: 'prerequisiteSpell', spellId: 'plasma_arc' },
  ],
  effectKind: 'line_damage',
  range: 5,
  baseDamage: 10,
  statusEffects: [
    { statusId: burn.id, duration: 3, target: 'affectedTargets' },
    { statusId: slow.id, duration: 2, target: 'affectedTargets' },
  ],
};
