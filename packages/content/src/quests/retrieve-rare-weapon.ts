import type { QuestTemplate } from './types.js';

export const retrieveRareWeapon: QuestTemplate = {
  id: 'retrieve_rare_weapon',
  title: 'Retrieve the Lost Artifact',
  description: 'An ancient artifact—a frost-forged axe of legendary power—was lost deep in the dungeon generations ago. Its icy edge could turn the tide in our defense. Retrieve it and bring it back.',
  objectiveText: 'Recover the Frost Axe and bring it back to town.',
  objective: {
    type: 'collect_item',
    targetId: 'frost_axe',
    targetCount: 1,
    progress: 0,
  },
  reward: {
    type: 'gold',
    amount: 75,
  },
};
