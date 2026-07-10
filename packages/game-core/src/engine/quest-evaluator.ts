import type { GameState, DomainEvent } from '@dungeon/contracts';
import { evaluateQuestProgress } from '../systems/quest-progress.js';

/**
 * Evaluates progress on all active quests and returns any progress events.
 * Called after each game command to update quest status.
 */
export function evaluateAllQuestProgress(
  state: GameState,
): { state: GameState; events: DomainEvent[] } {
  return state.activeQuests.reduce<{ state: GameState; events: DomainEvent[] }>((progress, quest) => {
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
  }, { state, events: [] });
}
