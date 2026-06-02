import type { StatusDefinition } from './types.js';

export const stormActive: StatusDefinition = {
  id: 'storm_active',
  name: 'Storm Active',
  description: 'A thunderstorm rages around you for 3 turns, striking 1-3 random visible enemies each turn with shock, burn, and stun.',
  stackable: false,
  beneficial: true,
  tickEffect: 'none',
  tickMagnitudeKey: '',
  modifiesStat: null,
  statMultiplierKey: null,
};
