import { animationRefs } from '../animation-refs/index.js';
import type { StatusDefinition } from './types.js';

export const arcaneCharge: StatusDefinition = {
  id: 'arcane_charge',
  name: 'Arcane Charge',
  description: 'Increases spell power. Stacks up to 3 times.',
  stackable: true,
  beneficial: true,
  tickEffect: 'none',
  tickMagnitudeKey: 'arcane_charge.none',
  modifiesStat: null,
  statMultiplierKey: null,
  overlay: { id: animationRefs.status.arcaneChargeRing.id },
};
