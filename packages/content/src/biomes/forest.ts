import type { BiomeDefinition } from './stone-crypt.js';

export const forest: BiomeDefinition = {
  biomeId: 'forest',
  name: 'Deep Forest',
  description: 'A dense woodland filled with ancient trees and lurking vermin.',
  floorRange: { min: 2, max: 4 },
  tileWeights: { floor: 0.6, wall: 0.3, door: 0.1 },
  ambientColor: '#2a4a2a',
  floorAscii: '.',
  wallAscii: 'T',
  mapGen: {
    roomWidth: [6, 12],
    roomHeight: [5, 9],
    corridorLength: [1, 2],
    dugPercentage: 0.65,
  },
};
