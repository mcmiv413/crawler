import {
  serializeState,
} from '@dungeon/core';
import type { GameEngine } from '@dungeon/core';
import type { AiService } from '@dungeon/core/ai/ai-service.js';
import {
  buildAnimationSequence,
  buildGameView,
  formatEvents,
  type GameView,
} from '@dungeon/presenter';
import type {
  DomainEvent,
  EntityId,
  GameCommand,
  GameState,
  IGameRepository,
  RunMetrics,
} from '@dungeon/contracts';
import {
  buildDeterministicRunSummary,
  buildDeterministicTownRumors,
} from './town-text.js';

const MAX_EVENT_HISTORY = 100;

export interface CommandProcessingLogger {
  warn(...args: unknown[]): void;
}

export interface ProcessGameCommandArgs {
  readonly ai: AiService;
  readonly command: GameCommand;
  readonly engine: GameEngine;
  readonly gameId: EntityId;
  readonly log: CommandProcessingLogger;
  readonly repo: IGameRepository;
  readonly state: GameState;
}

export interface ProcessGameCommandResult {
  readonly events: readonly DomainEvent[];
  readonly runEnded: boolean;
  readonly serializedState: string;
  readonly view: GameView;
}

interface PreparedCommandState {
  readonly archivedEvents: readonly DomainEvent[];
  readonly events: readonly DomainEvent[];
  readonly finalState: GameState;
  readonly metrics: RunMetrics | null;
  readonly runEnded: boolean;
}

export async function processGameCommand(
  args: ProcessGameCommandArgs,
): Promise<ProcessGameCommandResult> {
  const prepared = await prepareCommandState(args);
  const persistedState = appendEventHistory(prepared.finalState, prepared.events);

  await args.repo.commitTick(
    args.gameId,
    args.state.version,
    persistedState,
    prepared.events,
  );

  if (prepared.metrics !== null) {
    args.repo.recordRunMetrics(prepared.metrics, args.gameId);
  }

  if (prepared.archivedEvents.length > 0) {
    await args.repo.appendEvents(args.gameId, prepared.archivedEvents);
  }

  return buildCommandResponse(
    persistedState,
    prepared.events,
    prepared.runEnded,
  );
}

async function prepareCommandState(
  args: ProcessGameCommandArgs,
): Promise<PreparedCommandState> {
  const result = args.engine.submitCommand(args.state, args.command);

  let finalState = result.state;
  let metrics: RunMetrics | null = null;
  let archivedEvents: readonly DomainEvent[] = [];

  if (result.runEnded) {
    const completedMetrics = finalState.run?.runMetrics ?? finalState.lastRunMetrics;
    if (completedMetrics) {
      metrics = completedMetrics;
      archivedEvents = getArchivedEvents(finalState);
      finalState = attachRunSummary(finalState, result.events);
      finalState = attachRumors(finalState);
    }
  }

  return {
    archivedEvents,
    events: result.events,
    finalState,
    metrics,
    runEnded: result.runEnded,
  };
}

function attachRunSummary(
  state: GameState,
  events: readonly DomainEvent[],
): GameState {
  const metrics = state.run?.runMetrics ?? state.lastRunMetrics;
  if (metrics === undefined) {
    return state;
  }

  const summary = buildDeterministicRunSummary(state, metrics, events);

  return {
    ...state,
    world: {
      ...state.world,
      town: {
        ...state.world.town,
        lastRunSummary: summary,
      },
    },
  };
}

function attachRumors(
  state: GameState,
): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      town: {
        ...state.world.town,
        rumors: buildDeterministicTownRumors(state),
      },
    },
  };
}

function getArchivedEvents(state: GameState): readonly DomainEvent[] {
  const historyLength = state.world.eventHistory.length;
  if (historyLength <= MAX_EVENT_HISTORY) {
    return [];
  }

  return state.world.eventHistory.slice(0, historyLength - MAX_EVENT_HISTORY);
}

function appendEventHistory(
  state: GameState,
  events: readonly DomainEvent[],
): GameState {
  if (events.length === 0) {
    return state;
  }

  return {
    ...state,
    world: {
      ...state.world,
      eventHistory: [...state.world.eventHistory, ...events],
    },
  };
}

function buildCommandResponse(
  state: GameState,
  events: readonly DomainEvent[],
  runEnded: boolean,
): ProcessGameCommandResult {
  const view = buildGameView(state);
  const combatLog = formatEvents(events);
  const animatedEvents = buildAnimationSequence(events, state);

  return {
    view: { ...view, combatLog, animatedEvents },
    events,
    runEnded,
    serializedState: serializeState(state),
  };
}
