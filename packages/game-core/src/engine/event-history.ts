import type { DomainEvent, GameState } from '@dungeon/contracts';
import { MAX_EVENT_HISTORY } from '@dungeon/content';

export function appendEventHistory(
  state: GameState,
  events: readonly DomainEvent[],
): GameState {
  if (events.length === 0) {
    return state;
  }

  const eventHistory = [...state.world.eventHistory, ...events].slice(-MAX_EVENT_HISTORY);

  return {
    ...state,
    world: {
      ...state.world,
      eventHistory,
    },
  };
}
