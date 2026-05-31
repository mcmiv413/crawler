import { animationRefs } from '../animation-refs/index.js';
import { heatSurgeStatus } from '../statuses/index.js';
import type { RingSpellDefinition } from './types.js';

export const heatSurge: RingSpellDefinition = {
  id: 'heat_surge',
  name: 'Heat Surge',
  description: 'Spend 11 mana to make your attacks and offensive spells apply Burn.',
  cooldown: 2,
  requiresTarget: false,
  unlockLevel: 1,
  manaCost: 11,
  xpGainOnCast: 2,
  animation: { id: animationRefs.self.heatSurgeAura.id },
  schools: ['fire'],
  studyRequirements: [
    { kind: 'equippedSchool', school: 'fire' },
    { kind: 'minimumSchoolXp', school: 'fire', xp: 20 },
    { kind: 'goldCost', gold: 60 },
  ],
  effectKind: 'self_buff',
  range: 0,
  statusEffects: [{ statusId: heatSurgeStatus.id, duration: 3, target: 'self' }],
};
