import type { StatusDefinition } from './types.js';

export const bleed: StatusDefinition = {
  id: 'bleed',
  name: 'Bleed',
  description: 'Loses health each turn from open wounds.',
  stackable: false,
  beneficial: false,
  tickEffect: 'damage',
  tickMagnitudeKey: 'bleed.damagePerTurn',
  modifiesStat: null,
  statMultiplierKey: null,
};
