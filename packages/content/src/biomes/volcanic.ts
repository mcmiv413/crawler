import type { BiomeDefinition } from './stone-crypt.js';

export const volcanic: BiomeDefinition = {
  biomeId: 'volcanic',
  name: 'Volcanic Cavern',
  description: 'A scorching underground volcano filled with molten flows and heat-resistant monsters.',
  floorRange: { min: 3, max: 5 },
  tileWeights: { floor: 0.6, wall: 0.3, door: 0.1 },
  ambientColor: '#4a2200',
  floorAscii: ',',
  wallAscii: '^',
};
