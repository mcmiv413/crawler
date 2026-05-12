import type { StatusDefinition } from './types.js';

export const panic: StatusDefinition = {
  id: 'panic',
  name: 'Panic',
  description: 'Reduced accuracy and evasion. Applied by Cinder Wake to burning enemies.',
  stackable: false,
  beneficial: false,
  tickEffect: 'none',
  tickMagnitudeKey: 'panic.none',
  modifiesStat: 'accuracy',
  statMultiplierKey: null,
};
