import type { StatusDefinition } from './types.js';

export const weaken: StatusDefinition = {
  id: 'weaken',
  name: 'Weaken',
  description: 'Attack power is reduced.',
  stackable: false,
  beneficial: false,
  tickEffect: 'none',
  tickMagnitudeKey: '',
  modifiesStat: 'attack',
  statMultiplierKey: 'weaken.attackMultiplier',
};
