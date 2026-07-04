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
  let currentState = state;
  const mutableEvents: DomainEvent[] = [];

  for (const quest of state.activeQuests) {
    if (quest.status === 'active' && quest.objective.type === 'reach_floor') {
      const targetDepth = quest.objective.targetCount ?? 0;
      if (newDepth === targetDepth) {
        const result = evaluateQuestProgress(quest, currentState);
        currentState = {
          ...currentState,
          activeQuests: currentState.activeQuests.map(q =>
            q.id === quest.id ? result.quest : q,
          ),
        };
        mutableEvents.push(...result.events);
      }
    }
  }

  return { state: currentState, events: mutableEvents };
}
