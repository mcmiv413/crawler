import { animationRefs } from '../animation-refs/index.js';
import type { StatusDefinition } from './types.js';

export const strength: StatusDefinition = {
  id: 'strength',
  name: 'Strength',
  description: 'Attack power is temporarily increased.',
  stackable: false,
  beneficial: true,
  tickEffect: 'none',
  tickMagnitudeKey: '',
  modifiesStat: 'attack',
  statMultiplierKey: null,
  overlay: { id: animationRefs.status.goldRingPulse.id },
};
