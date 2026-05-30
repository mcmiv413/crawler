import { create } from 'zustand';
import { getAnimatedEventBatchSettleMs } from '@dungeon/presenter';
import type { GameView, CombatLogEntry } from '@dungeon/presenter';
import {
  createGame as createGameRequest,
  fetchGameView,
  GameNotFoundError,
  restoreGame,
  sendCommand as sendCommandRequest,
} from '../api/client.js';
import type { CommandResponse } from '../api/client.js';
import { isQueueDraining, onQueueDrained } from '../animation-runtime/animation-queue-bus.js';
import { isBeatSchedulerEnabledFlag } from '../config/feature-flags.js';
import { saveSession, loadSession, clearSession } from './session-persistence.js';

interface Position {
  readonly x: number;
  readonly y: number;
}

interface GameStore {
  gameId: string | null;
  view: GameView | null;
  combatLog: CombatLogEntry[];
  loading: boolean;
  error: string | null;
  autoWalkPath: Position[];
  autoWalkKnownEnemyIds: Set<string>;
  debugLogging: boolean;
  deathTransitioning: boolean;
  sessionToken: string | null;

  createGame: (seed?: number, playerName?: string) => Promise<void>;
  sendCommand: (command: unknown) => Promise<void>;
  refreshView: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  resetGame: () => void;
  clearError: () => void;
  startAutoWalk: (path: Position[]) => void;
  cancelAutoWalk: () => void;
  toggleDebugLogging: () => Promise<void>;
}

let pendingViewTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingQueueDrainUnsubscribe: (() => void) | null = null;
let pendingQueueDrainCommit: {
  readonly view: GameView;
  readonly combatLog: CombatLogEntry[];
} | null = null;

type SetGameStore = (partial: Partial<GameStore>) => void;
type GetGameStore = () => GameStore;

const FATAL_RESTORE_CODES = new Set([
  'INCOMPATIBLE_SAVE_FILE',
  'INVALID_GAME_STATE',
  'INVALID_SAVE_FILE',
  'MISSING_SERIALIZED_STATE',
]);

const FATAL_RESTORE_MESSAGES = new Set([
  'Incompatible save file',
  'Invalid game state',
  'Invalid save file',
  'Missing serializedState',
]);

function shouldClearSavedSession(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const apiError = error as Error & { readonly code?: string; readonly status?: number };

  // 403 SESSION_FORBIDDEN is fatal — clear the saved session
  if (apiError.status === 403 && apiError.code === 'SESSION_FORBIDDEN') {
    return true;
  }

  // Legacy 400 errors
  if (apiError.status !== 400) {
    return false;
  }

  return FATAL_RESTORE_CODES.has(apiError.code ?? '') || FATAL_RESTORE_MESSAGES.has(apiError.message);
}

function initialStoreState(): Pick<
  GameStore,
  | 'gameId'
  | 'view'
  | 'combatLog'
  | 'loading'
  | 'error'
  | 'autoWalkPath'
  | 'autoWalkKnownEnemyIds'
  | 'debugLogging'
  | 'deathTransitioning'
  | 'sessionToken'
> {
  return {
    gameId: null,
    view: null,
    combatLog: [],
    loading: false,
    error: null,
    autoWalkPath: [],
    autoWalkKnownEnemyIds: new Set(),
    debugLogging: false,
    deathTransitioning: false,
    sessionToken: null,
  };
}

function appendCombatLog(current: readonly CombatLogEntry[], next: readonly CombatLogEntry[]): CombatLogEntry[] {
  return [...current, ...next].slice(-50);
}

function isAttackCommand(command: unknown): boolean {
  return typeof command === 'object' &&
    command !== null &&
    (command as Record<string, unknown>).type === 'ATTACK';
}

function logDebugAttack(debugLogging: boolean, command: unknown, view: GameView | null): void {
  if (!debugLogging || !isAttackCommand(command)) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[DEBUG] Attack Command:', {
    playerAccuracy: view?.player.accuracy,
    playerAttack: view?.player.attack,
    command,
    timestamp: new Date().toISOString(),
  });
}

function logDebugCombatResult(debugLogging: boolean, view: GameView): void {
  if (!debugLogging || view.combatLog.length === 0) {
    return;
  }

  const lastEntry = view.combatLog[view.combatLog.length - 1];
  // eslint-disable-next-line no-console
  console.log('[DEBUG] Combat Result:', {
    lastLogEntry: lastEntry?.text,
    playerHealth: view.player.health,
    timestamp: new Date().toISOString(),
  });
}

async function sendCommandWithColdRestore(
  gameId: string,
  command: unknown,
  sessionToken: string | null,
  set: SetGameStore,
): Promise<{ result: CommandResponse; sessionToken: string | undefined }> {
  const currentSessionToken = sessionToken ?? undefined;

  try {
    const result = await sendCommandRequest(gameId, command, currentSessionToken);
    return { result, sessionToken: currentSessionToken };
  } catch (err) {
    if (!(err instanceof GameNotFoundError)) {
      throw err;
    }
  }

  const saved = loadSession();
  if (!saved) {
    throw new Error('Game session expired. Please start a new game.');
  }

  const restored = await restoreGame(saved.serializedState, saved.sessionToken);
  set({ sessionToken: restored.sessionToken });
  const result = await sendCommandRequest(gameId, command, restored.sessionToken);
  return { result, sessionToken: restored.sessionToken };
}

function isDeathTransition(currentView: GameView | null, nextView: GameView): boolean {
  const dungeonToEndPhase =
    currentView !== null &&
    currentView.phase === 'dungeon' &&
    (nextView.phase === 'town' || nextView.phase === 'game_over');

  const hasDeathSignal =
    Boolean(nextView.deathContext?.killerName) ||
    nextView.runResult === 'permadeath';

  return dungeonToEndPhase && hasDeathSignal;
}

function clearPendingViewTimeout(): void {
  if (pendingViewTimeout) {
    clearTimeout(pendingViewTimeout);
  }
  pendingViewTimeout = null;
}

function clearPendingQueueDrainCommit(): void {
  pendingQueueDrainUnsubscribe?.();
  pendingQueueDrainUnsubscribe = null;
  pendingQueueDrainCommit = null;
}

function clearPendingAnimationCommits(): void {
  clearPendingViewTimeout();
  clearPendingQueueDrainCommit();
}

function isBeatSchedulerEnabled(): boolean {
  return isBeatSchedulerEnabledFlag();
}

function ensureQueueDrainSubscription(set: SetGameStore): void {
  if (pendingQueueDrainUnsubscribe !== null) {
    return;
  }

  pendingQueueDrainUnsubscribe = onQueueDrained(() => {
    const pendingCommit = pendingQueueDrainCommit;
    clearPendingQueueDrainCommit();
    if (pendingCommit === null) {
      return;
    }

    set({
      view: pendingCommit.view,
      combatLog: pendingCommit.combatLog,
      loading: false,
      deathTransitioning: false,
    });
  });
}

function applyCommandResult(
  result: CommandResponse,
  isDeath: boolean,
  set: SetGameStore,
  get: GetGameStore,
): void {
  const currentView = get().view;
  const combatLog = appendCombatLog(get().combatLog, result.view.combatLog);
  const animationSettleMs = getAnimatedEventBatchSettleMs(result.view.animatedEvents);
  const shouldStageView =
    currentView !== null
    && currentView.phase === 'dungeon'
    && animationSettleMs > 0;

  if (!shouldStageView && !isDeath) {
    clearPendingAnimationCommits();
    set({
      view: result.view,
      combatLog,
      loading: false,
      deathTransitioning: false,
    });
    return;
  }

  clearPendingViewTimeout();

  if (shouldStageView) {
    if (isBeatSchedulerEnabled()) {
      pendingQueueDrainCommit = {
        view: result.view,
        combatLog,
      };
      ensureQueueDrainSubscription(set);
      set({
        view: result.view,
        combatLog,
        deathTransitioning: isDeath,
        loading: false,
      });
      return;
    }

    clearPendingQueueDrainCommit();
    set({
      view: result.view,
      combatLog,
      deathTransitioning: isDeath,
      loading: false,
    });

    pendingViewTimeout = setTimeout(() => {
      set({
        view: result.view,
        combatLog,
        loading: false,
        deathTransitioning: false,
      });
      pendingViewTimeout = null;
    }, isDeath ? Math.max(animationSettleMs, 2000) : animationSettleMs);
    return;
  }

  clearPendingQueueDrainCommit();
  set({
    view: result.view,
    combatLog,
    deathTransitioning: true,
    loading: false,
  });

  pendingViewTimeout = setTimeout(() => {
    set({
      view: result.view,
      deathTransitioning: false,
      combatLog,
    });
    pendingViewTimeout = null;
  }, 2000);
}

function createCreateGameAction(set: SetGameStore): GameStore['createGame'] {
  return async (seed, playerName) => {
    clearPendingAnimationCommits();
    set({ loading: true, error: null });
    try {
      const result = await createGameRequest(seed, playerName);
      saveSession(result.gameId, result.serializedState, result.sessionToken);
      set({
        gameId: result.gameId,
        view: result.view,
        combatLog: [],
        loading: false,
        sessionToken: result.sessionToken,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  };
}

function createSendCommandAction(set: SetGameStore, get: GetGameStore): GameStore['sendCommand'] {
  return async (command) => {
    const { gameId, sessionToken, debugLogging } = get();
    if (!gameId) return;

    set({ loading: true, error: null });
    try {
      logDebugAttack(debugLogging, command, get().view);
      const { result, sessionToken: currentSessionToken } =
        await sendCommandWithColdRestore(gameId, command, sessionToken, set);
      saveSession(gameId, result.serializedState, currentSessionToken);
      logDebugCombatResult(debugLogging, result.view);
      const currentView = get().view;
      applyCommandResult(result, isDeathTransition(currentView, result.view), set, get);
    } catch (err) {
      if (shouldClearSavedSession(err)) {
        clearSession();
        set({ sessionToken: null });
      }
      set({ error: (err as Error).message, loading: false });
    }
  };
}

function createRefreshViewAction(set: SetGameStore, get: GetGameStore): GameStore['refreshView'] {
  return async () => {
    const { gameId, sessionToken } = get();
    if (!gameId) return;

    try {
      const view = await fetchGameView(gameId, sessionToken ?? undefined);
      set({ view });
    } catch (err) {
      if (shouldClearSavedSession(err)) {
        clearSession();
        set({ sessionToken: null });
      }
      set({ error: (err as Error).message });
    }
  };
}

function createRestoreSessionAction(set: SetGameStore): GameStore['restoreSession'] {
  return async () => {
    const saved = loadSession();
    if (!saved) return false;

    clearPendingAnimationCommits();
    set({ loading: true, error: null });
    try {
      // Try fetching view directly (server may still have it warm)
      try {
        const view = await fetchGameView(saved.gameId, saved.sessionToken);
        set({ gameId: saved.gameId, view, combatLog: [], loading: false, sessionToken: saved.sessionToken ?? null });
        return true;
      } catch {
        // Server lost it (cold start) — restore from client state
      }
      const result = await restoreGame(saved.serializedState, saved.sessionToken);
      saveSession(result.gameId, result.serializedState, result.sessionToken);
      set({ gameId: result.gameId, view: result.view, combatLog: [], loading: false, sessionToken: result.sessionToken });
      return true;
    } catch (err) {
      if (shouldClearSavedSession(err)) {
        clearSession();
      }
      set({ error: (err as Error).message, loading: false, sessionToken: null });
      return false;
    }
  };
}

function createResetGameAction(set: SetGameStore): GameStore['resetGame'] {
  return () => {
    clearPendingAnimationCommits();
    clearSession();
    set({ gameId: null, view: null, combatLog: [], error: null, autoWalkPath: [], autoWalkKnownEnemyIds: new Set(), deathTransitioning: false, sessionToken: null });
  };
}

function createStartAutoWalkAction(set: SetGameStore, get: GetGameStore): GameStore['startAutoWalk'] {
  return (path) => {
    const view = get().view;
    const knownEnemyIds = new Set<string>();
    if (view?.map) {
      for (const entity of view.map.entities) {
        if (entity.type === 'enemy') knownEnemyIds.add(entity.id);
      }
    }
    set({ autoWalkPath: path, autoWalkKnownEnemyIds: knownEnemyIds });
  };
}

function createGameStore(set: SetGameStore, get: GetGameStore): GameStore {
  return {
    ...initialStoreState(),
    createGame: createCreateGameAction(set),
    sendCommand: createSendCommandAction(set, get),
    refreshView: createRefreshViewAction(set, get),
    restoreSession: createRestoreSessionAction(set),
    resetGame: createResetGameAction(set),
    clearError: () => set({ error: null }),
    startAutoWalk: createStartAutoWalkAction(set, get),
    cancelAutoWalk: () => set({ autoWalkPath: [], autoWalkKnownEnemyIds: new Set() }),
    toggleDebugLogging: async () => {
      await get().sendCommand({ type: 'TOGGLE_DEBUG' });
    },
  };
}

export const useGameStore = create<GameStore>((set, get) => createGameStore(set, get));
