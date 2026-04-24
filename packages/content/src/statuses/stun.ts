import type { StatusDefinition } from './types.js';

export const stun: StatusDefinition = {
  id: 'stun',
  name: 'Stun',
  description: 'Cannot act this turn.',
  stackable: false,
  beneficial: false,
  tickEffect: 'none',
  tickMagnitudeKey: '',
  modifiesStat: null,
  statMultiplierKey: null,
};
