import type { BiomeDefinition } from './stone-crypt.js';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const goblinWarrens: BiomeDefinition = {
  biomeId: 'goblin_warrens',
  name: 'Goblin Warrens',
  description: 'Cramped tunnels dug by goblin miners. Crude traps everywhere.',
  floorRange: { min: 2, max: 4 },
  tileWeights: { floor: 0.50, wall: 0.38, door: 0.12 },
  ambientColor: '#5a4a2a',
  floorAscii: ',',
  wallAscii: '#',
  tileSprites: {
    floor: SPRITE_MAP['tile:floor:goblin_warrens'],
    interactable: SPRITE_MAP['tile:interactable:goblin_warrens'],
  },
  mapGen: {
    roomWidth: [2, 4],
    roomHeight: [2, 3],
    corridorLength: [2, 7],
    dugPercentage: 0.32,
  },
};
