import type { QuestTemplate } from './types.js';

export const rescueExpedition: QuestTemplate = {
  id: 'rescue_expedition',
  title: 'Find the Lost Expedition',
  description: 'A research expedition disappeared months ago while studying the dungeon\'s deepest levels. The council fears they\'re lost beyond floor 7. Venture deep to find any survivors or their research notes.',
  objective: {
    type: 'reach_floor',
    targetId: undefined,
    targetCount: 7,
    progress: 0,
  },
  reward: {
    type: 'gold',
    amount: 120,
  },
};
