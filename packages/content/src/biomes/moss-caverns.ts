import type { BiomeDefinition } from './stone-crypt.js';

export const mossCaverns: BiomeDefinition = {
  biomeId: 'moss_caverns',
  name: 'Moss Caverns',
  description: 'Damp caves thick with bioluminescent moss and dripping water.',
  floorRange: { min: 3, max: 5 },
  tileWeights: { floor: 0.52, wall: 0.35, door: 0.13 },
  ambientColor: '#2a4a2a',
  floorAscii: '~',
  wallAscii: '#',
  tileSprites: {
    floor: 'day tile floor c',
    wall: 'bright rock wall center',
    interactable: 'closed wooden door front',
  },
  mapGen: {
    roomWidth: [3, 7],
    roomHeight: [3, 6],
    corridorLength: [1, 4],
    dugPercentage: 0.48,
    algorithm: 'cellular',
    fillProbability: 0.50,
    iterations: 5,
  },
};
