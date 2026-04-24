import type { StatusDefinition } from './types.js';

export const slow: StatusDefinition = {
  id: 'slow',
  name: 'Slow',
  description: 'Movement speed is reduced.',
  stackable: false,
  beneficial: false,
  tickEffect: 'none',
  tickMagnitudeKey: '',
  modifiesStat: 'speed',
  statMultiplierKey: 'slow.speedMultiplier',
};
