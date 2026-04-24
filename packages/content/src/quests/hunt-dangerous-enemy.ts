import type { Quest } from '@dungeon/contracts';
import type { QuestTemplate } from './types.js';

export const huntDangerousEnemy: QuestTemplate = {
  id: 'hunt_dangerous_enemy',
  title: 'Eliminate the Shadowborn',
  description: 'A dangerous creature has been terrorizing our people. Defeat it and return with proof of your victory.',
  targetEnemyTemplateId: 'shadow_lurker',
  rewardGold: 100,
};
