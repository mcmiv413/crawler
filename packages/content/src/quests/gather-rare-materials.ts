import type { QuestTemplate } from './types.js';

export const gatherRareMaterials: QuestTemplate = {
  id: 'gather_rare_materials',
  title: 'Reach the Crystal Veins',
  description: 'We need rare materials to craft new defenses for the settlement. Ancient crystal veins lie deep in the dungeon on floor 5 and beyond. Reach them and survey the area for harvestable materials.',
  objective: {
    type: 'reach_floor',
    targetId: undefined,
    targetCount: 5,
    progress: 0,
  },
  reward: {
    type: 'gold',
    amount: 60,
  },
};
