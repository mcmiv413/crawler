import type { QuestTemplate } from './types.js';

export const findEnchantedArmor: QuestTemplate = {
  id: 'find_enchanted_armor',
  title: 'Seek the Warden\'s Cloak',
  description: 'Legend speaks of enchanted armor hidden in the deepest chambers. The council needs this protective gear to defend against future threats. Venture into the dungeon and recover it.',
  objectiveText: 'Recover the Plate Armor and return it to the council.',
  objective: {
    type: 'collect_item',
    targetId: 'plate_armor',
    targetCount: 1,
    progress: 0,
  },
  reward: {
    type: 'gold',
    amount: 85,
  },
};
