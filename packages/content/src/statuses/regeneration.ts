import type { StatusDefinition } from './types.js';

export const regeneration: StatusDefinition = {
  id: 'regeneration',
  name: 'Regeneration',
  description: 'Heals a small amount each turn.',
  stackable: false,
  beneficial: true,
  tickEffect: 'heal',
  tickMagnitudeKey: 'regeneration.healPerTurn',
  modifiesStat: null,
  statMultiplierKey: null,
};
