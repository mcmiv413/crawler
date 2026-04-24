import type { Quest } from '@dungeon/contracts';
import type { QuestTemplate } from './types.js';

export const retrieveRareWeapon: QuestTemplate = {
  id: 'retrieve_rare_weapon',
  title: 'Retrieve the Lost Artifact',
  description: 'An ancient artifact was lost deep in the dungeon. Retrieve any rare weapon and bring it back.',
  targetItemId: 'frost_axe',
  rewardGold: 75,
};
