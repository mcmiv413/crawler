import type { GameState, DomainEvent } from '@dungeon/contracts';
import { evaluateQuestProgress } from '../systems/quest-progress.js';

/**
 * Evaluates progress on all active quests and returns any progress events.
 * Called after each game command to update quest status.
 */
export function evaluateAllQuestProgress(
  state: GameState,
): { state: GameState; events: DomainEvent[] } {
  return state.activeQuests.reduce<{ state: GameState; events: DomainEvent[] }>((current, quest) => {
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
  }, { state, events: [] });
}
