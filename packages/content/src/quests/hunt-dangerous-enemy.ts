import type { QuestTemplate } from './types.js';

export const huntDangerousEnemy: QuestTemplate = {
  id: 'hunt_dangerous_enemy',
  title: 'Hunt the Shadow Lurker',
  description: 'A dangerous shadow creature has been terrorizing nearby villages. Track it down in the dungeon and eliminate the threat. Return to claim your reward.',
  objective: {
    type: 'defeat_enemy',
    targetId: 'shadow_lurker',
    targetCount: 1,
    progress: 0,
  },
  reward: {
    type: 'gold',
    amount: 100,
  },
};
