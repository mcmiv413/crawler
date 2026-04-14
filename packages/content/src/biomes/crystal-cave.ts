import type { BiomeDefinition } from './stone-crypt.js';

export const crystalCave: BiomeDefinition = {
  biomeId: 'crystal_cave',
  name: 'Crystal Caverns',
  description: 'A magical cave filled with glowing crystals and arcane energy.',
  floorRange: { min: 4, max: 6 },
  tileWeights: { floor: 0.6, wall: 0.3, door: 0.1 },
  ambientColor: '#331a66',
  floorAscii: '.',
  wallAscii: '*',
  tileSprites: {
    floor: 'day tile floor c',
    wall: 'bright blue wall center',
    interactable: 'closed stone door front',
  },
  mapGen: {
    roomWidth: [4, 7],
    roomHeight: [3, 5],
    corridorLength: [2, 4],
    dugPercentage: 0.42,
    algorithm: 'cellular',
    fillProbability: 0.52,
    iterations: 4,
  },
};
