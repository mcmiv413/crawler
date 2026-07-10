import type { DomainEvent, GameState } from '@dungeon/contracts';
import { evaluateQuestProgress } from './quest-progress.js';

/**
 * Mark floor depth quests as ready when player reaches the target floor.
 * This is called after descending/ascending to a new floor.
 */
export function completeFloorDepthQuests(
  state: GameState,
  newDepth: number,
): { state: GameState; events: DomainEvent[] } {
  return state.activeQuests.reduce<{ state: GameState; events: DomainEvent[] }>((progress, quest) => {
    if (quest.status === 'active' && quest.objective.type === 'reach_floor') {
      const targetDepth = quest.objective.targetCount ?? 0;
      if (newDepth === targetDepth) {
        const result = evaluateQuestProgress(quest, progress.state);
        return {
          state: {
            ...progress.state,
            activeQuests: progress.state.activeQuests.map(q =>
              q.id === quest.id ? result.quest : q,
            ),
          },
          events: [...progress.events, ...result.events],
        };
      }
    }

    return progress;
  }, { state, events: [] });
}
