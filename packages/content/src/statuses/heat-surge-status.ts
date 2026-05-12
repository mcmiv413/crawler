import type { StatusDefinition } from './types.js';

export const heatSurgeStatus: StatusDefinition = {
  id: 'heat_surge',
  name: 'Heat Surge',
  description: 'Qualifying attacks and abilities apply burn.',
  stackable: false,
  beneficial: true,
  tickEffect: 'none',
  tickMagnitudeKey: 'heat_surge.none',
  modifiesStat: null,
  statMultiplierKey: null,
};
