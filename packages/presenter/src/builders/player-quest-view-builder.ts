import type { GameState } from '@dungeon/contracts';
import { getObjectiveText } from '@dungeon/core/systems/quest-progress.js';
import type { PlayerHudView } from '../game-view.js';

export function buildActiveQuestViews(state: GameState): PlayerHudView['activeQuests'] {
  return state.activeQuests.map(quest => ({
    id: quest.id,
    title: quest.title,
    description: quest.description,
    status: quest.status,
    objectiveText: getObjectiveText(quest),
    progress: quest.objective.progress,
    rewardGold: quest.reward.type === 'gold' ? quest.reward.amount : 0,
    giverNpcId: quest.giverNpcId,
  }));
}
