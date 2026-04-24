import type { StatusDefinition } from './types.js';

export const burn: StatusDefinition = {
  id: 'burn',
  name: 'Burn',
  description: 'Takes fire damage each turn.',
  stackable: false,
  beneficial: false,
  tickEffect: 'damage',
  tickMagnitudeKey: 'burn.damagePerTurn',
  modifiesStat: null,
  statMultiplierKey: null,
};
