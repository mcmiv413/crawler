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
  return state.activeQuests.reduce<{ state: GameState; events: DomainEvent[] }>((current, quest) => {
    if (quest.status === 'active' && quest.objective.type === 'reach_floor') {
      const targetDepth = quest.objective.targetCount ?? 0;
      if (newDepth === targetDepth) {
        const result = evaluateQuestProgress(quest, current.state);
        return {
          state: {
            ...current.state,
            activeQuests: current.state.activeQuests.map(q =>
              q.id === quest.id ? result.quest : q,
            ),
          },
          events: [...current.events, ...result.events],
        };
      }
    }

    return current;
  }, { state, events: [] });
}
