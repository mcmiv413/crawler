import { goblinWarlord } from '../enemies/index.js';
import type { FactionDefinition } from './types.js';

export const goblinWarband: FactionDefinition = {
  id: 'goblin_warband',
  name: 'Goblin Warband',
  description: 'Disorganized raiders motivated by greed and chaos.',
  lore: 'Once a loose rabble of cave-dwellers, these goblins have grown emboldened by the dungeon\'s depths. They hoard treasures and lay crude traps in the warrens they inhabit.',
  initialPower: 40,
  initialDisposition: -30,
  leader: {
    templateId: goblinWarlord.templateId,
    names: ['Brakka', 'Skritch', 'Mogren'],
    titles: ['Knife-King', 'Warren Tyrant', 'Banner-Eater'],
  },
};
