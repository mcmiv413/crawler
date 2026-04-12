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
};
