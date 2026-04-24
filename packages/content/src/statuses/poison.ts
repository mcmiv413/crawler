import type { StatusDefinition } from './types.js';

export const poison: StatusDefinition = {
  id: 'poison',
  name: 'Poison',
  description: 'Takes damage each turn from toxins.',
  stackable: false,
  beneficial: false,
  tickEffect: 'damage',
  tickMagnitudeKey: 'poison.damagePerTurn',
  modifiesStat: null,
  statMultiplierKey: null,
};
