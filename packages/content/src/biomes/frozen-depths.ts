import type { BiomeDefinition } from './stone-crypt.js';

export const frozenDepths: BiomeDefinition = {
  biomeId: 'frozen_depths',
  name: 'Frozen Depths',
  description: 'Ice-coated corridors where breath crystallizes instantly.',
  floorRange: { min: 4, max: 6 },
  tileWeights: { floor: 0.50, wall: 0.40, door: 0.10 },
  ambientColor: '#3a5a7a',
  floorAscii: '.',
  wallAscii: '█',
  tileSprites: {
    floor: 'day stone floor c',
    wall: 'dark ice wall center',
    interactable: 'statue',
  },
  mapGen: {
    roomWidth: [2, 4],
    roomHeight: [2, 3],
    corridorLength: [3, 9],
    dugPercentage: 0.35,
  },
};
