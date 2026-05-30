import { MAX_EVENT_HISTORY } from '@dungeon/content';
import type { DomainEvent, GameState } from '@dungeon/contracts';
import { deserializeState, serializeState } from '@dungeon/core';
import {
  buildAnimationSequence,
  buildGameView,
  formatEvents,
  type GameView,
} from '@dungeon/presenter';

export interface CanonicalGameState {
  state: GameState;
  serializedState: string;
}

type SessionGameResponse = Record<string, unknown> & {
  gameId: GameState['gameId'];
  view: GameView;
  serializedState: string;
  sessionToken: string;
};

type DetailedGameViewResponse = Record<string, unknown> & GameView & {
  combatLog: ReturnType<typeof formatEvents>;
  animatedEvents: ReturnType<typeof buildAnimationSequence>;
};

export function canonicalizeGameState(state: GameState): CanonicalGameState {
  const canonicalState = trimStateEventHistory(deserializeState(serializeState(state)));
  return {
    state: canonicalState,
    serializedState: serializeState(canonicalState),
  };
}

export function buildCreateGameResponse(
  state: GameState,
  sessionToken: string,
): SessionGameResponse {
  return {
    gameId: state.gameId,
    view: buildGameView(state),
    serializedState: canonicalizeGameState(state).serializedState,
    sessionToken,
  };
}

export function buildRestoreResponse(
  state: GameState,
  sessionToken: string,
  serializedState: string = canonicalizeGameState(state).serializedState,
): SessionGameResponse {
  return {
    gameId: state.gameId,
    view: buildGameView(state),
    serializedState,
    sessionToken,
  };
}

export function buildDetailedGameViewResponse(
  state: GameState,
  events: readonly DomainEvent[],
): DetailedGameViewResponse {
  const view = buildGameView(state);
  const combatLog = formatEvents(events);
  const animatedEvents = buildAnimationSequence(events, state);

  return {
    ...view,
    combatLog,
    animatedEvents,
  };
}

function trimStateEventHistory(state: GameState): GameState {
  if (state.world.eventHistory.length <= MAX_EVENT_HISTORY) {
    return state;
  }

  return {
    ...state,
    world: {
      ...state.world,
      eventHistory: state.world.eventHistory.slice(-MAX_EVENT_HISTORY),
    },
  };
}
