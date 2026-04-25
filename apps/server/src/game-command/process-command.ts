import {
  addItemToInventory,
  rollNemesisLoot,
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

interface NemesisLootResult {
  readonly events: readonly DomainEvent[];
  readonly state: GameState;
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

  let finalState = await applyNemesisPromotionName(
    result.state,
    result.events,
    args.ai,
  );
  const lootResult = await applyNemesisLoot(
    finalState,
    result.events,
    args.ai,
    args.log,
  );
  finalState = lootResult.state;

  let metrics: RunMetrics | null = null;
  let archivedEvents: readonly DomainEvent[] = [];

  if (result.runEnded && finalState.run?.runMetrics) {
    metrics = finalState.run.runMetrics;
    archivedEvents = getArchivedEvents(finalState);
    finalState = await attachRunSummary(finalState, lootResult.events, args.ai);
    finalState = await attachRumors(finalState, args.ai, args.log);
  }

  return {
    archivedEvents,
    events: lootResult.events,
    finalState,
    metrics,
    runEnded: result.runEnded,
  };
}

async function applyNemesisPromotionName(
  state: GameState,
  events: readonly DomainEvent[],
  ai: AiService,
): Promise<GameState> {
  const newNemesis = events.find(
    (event): event is Extract<DomainEvent, { type: 'NEMESIS_PROMOTED' }> =>
      event.type === 'NEMESIS_PROMOTED',
  );
  if (newNemesis === undefined) {
    return state;
  }

  const promoted = state.world.nemeses.find(
    nemesis => nemesis.id === newNemesis.nemesisId,
  );
  if (promoted === undefined) {
    return state;
  }

  const aiName = await ai.generateNemesisName({
    enemyTemplateName: promoted.sourceTemplateId,
    tier: promoted.tier,
    floor: promoted.floorOfAscension,
    biome: promoted.biomeOfAscension,
  });

  return {
    ...state,
    world: {
      ...state.world,
      nemeses: state.world.nemeses.map(nemesis =>
        nemesis.id === promoted.id
          ? { ...nemesis, name: aiName.name, title: aiName.title }
          : nemesis,
      ),
    },
  };
}

async function applyNemesisLoot(
  state: GameState,
  events: readonly DomainEvent[],
  ai: AiService,
  log: CommandProcessingLogger,
): Promise<NemesisLootResult> {
  const slainEvent = events.find(
    (event): event is Extract<DomainEvent, { type: 'NEMESIS_SLAIN' }> =>
      event.type === 'NEMESIS_SLAIN',
  );
  if (slainEvent === undefined) {
    return { events, state };
  }

  const slainNemesis = state.world.nemeses.find(
    nemesis => nemesis.id === slainEvent.nemesisId,
  );
  if (slainNemesis === undefined) {
    return { events, state };
  }

  try {
    const lootData = await ai.generateNemesisLoot({
      nemesisName: slainNemesis.name,
      nemesisTitle: slainNemesis.title,
      tier: slainNemesis.tier,
      floor: slainNemesis.floorOfAscension,
      traits: slainNemesis.traits,
      weaponType: slainNemesis.killedByWeaponType,
      rank: slainNemesis.rank,
    });

    const lootTemplate = rollNemesisLoot(
      lootData,
      slainNemesis.rank,
      slainNemesis.tier,
      state.player.floor,
      slainNemesis.killedByWeaponType,
    );

    const lootResult = addItemToInventory(state, lootTemplate);
    const updatedEvents = events.map(event =>
      event.type === 'NEMESIS_SLAIN'
        ? { ...event, lootItemName: lootData.name }
        : event,
    );

    return {
      events: updatedEvents,
      state: lootResult.state,
    };
  } catch (error) {
    log.warn({ error }, 'Failed to generate nemesis loot');
    return { events, state };
  }
}

async function attachRunSummary(
  state: GameState,
  events: readonly DomainEvent[],
  ai: AiService,
): Promise<GameState> {
  const metrics = state.run?.runMetrics;
  if (metrics === undefined) {
    return state;
  }

  const summary = await ai.generateRunSummary({
    runMetrics: metrics,
    recentEvents: events,
    playerName: state.player.name,
    floor: state.player.floor,
  });

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

async function attachRumors(
  state: GameState,
  ai: AiService,
  log: CommandProcessingLogger,
): Promise<GameState> {
  const rumorCount = 3;
  const rumorArgs = {
    townState: state.world.town,
    deepestFloor: state.world.deepestFloor,
    totalRuns: state.world.totalRuns,
    recentEvents: state.world.eventHistory.slice(-10),
  };

  try {
    const rumors = await Promise.all(
      Array.from({ length: rumorCount }, () => ai.generateRumor(rumorArgs)),
    );

    return {
      ...state,
      world: {
        ...state.world,
        town: {
          ...state.world.town,
          rumors,
        },
      },
    };
  } catch (error) {
    log.warn({ error }, 'Failed to generate rumors');
    return state;
  }
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
