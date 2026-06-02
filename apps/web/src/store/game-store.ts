import { create } from 'zustand';
import type { GameView, CombatLogEntry } from '@dungeon/presenter';
import {
  createGame as createGameRequest,
  fetchGameView,
} from '../api/client.js';
import type { CommandResponse } from '../api/client.js';
import { saveSession, loadSession, clearSession } from './session-persistence.js';
import {
  shouldClearSavedSession,
  sendCommandWithColdRestore,
  restoreSessionWarmOrCold,
} from './session-restore-service.js';
import {
  clearPendingAnimationCommits,
  scheduleCommandResultCommit,
  type CommandResultCommitOptions,
} from './command-result-commit-coordinator.js';
import {
  logDebugAttack,
  logDebugCombatResult,
} from './debug-logging.js';
import {
  appendCombatLog,
  isDeathTransition,
} from './command-result-reducer.js';

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
  tileTargetMode: { active: boolean; selectedAbilityId: string | null };

  createGame: (seed?: number, playerName?: string) => Promise<void>;
  sendCommand: (command: unknown) => Promise<void>;
  refreshView: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  resetGame: () => void;
  clearError: () => void;
  startAutoWalk: (path: Position[]) => void;
  cancelAutoWalk: () => void;
  toggleDebugLogging: () => Promise<void>;
  startTileTargeting: (abilityId: string) => void;
  cancelTileTargeting: () => void;
}

type SetGameStore = (partial: Partial<GameStore>) => void;
type GetGameStore = () => GameStore;

function inactiveTileTargetMode(): GameStore['tileTargetMode'] {
  return { active: false, selectedAbilityId: null };
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
  | 'tileTargetMode'
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
    tileTargetMode: inactiveTileTargetMode(),
  };
}



function applyCommandResult(
  result: CommandResponse,
  isDeath: boolean,
  set: SetGameStore,
  get: GetGameStore,
): void {
  const currentView = get().view;
  const combatLog = appendCombatLog(get().combatLog, result.view.combatLog);

  const options: CommandResultCommitOptions = {
    view: result.view,
    combatLog,
    isDeath,
    currentView,
    onCommit: (state) => {
      set(state);
    },
  };

  scheduleCommandResultCommit(options);
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
        tileTargetMode: inactiveTileTargetMode(),
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
        await sendCommandWithColdRestore(gameId, command, sessionToken);
      set({ sessionToken: currentSessionToken });
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
      const { gameId, view, sessionToken } = await restoreSessionWarmOrCold(saved);
      set({
        gameId,
        view,
        combatLog: [],
        loading: false,
        sessionToken: sessionToken ?? null,
        tileTargetMode: inactiveTileTargetMode(),
      });
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
    set({
      gameId: null,
      view: null,
      combatLog: [],
      error: null,
      autoWalkPath: [],
      autoWalkKnownEnemyIds: new Set(),
      deathTransitioning: false,
      sessionToken: null,
      tileTargetMode: inactiveTileTargetMode(),
    });
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
    startTileTargeting: (abilityId: string) => set({ tileTargetMode: { active: true, selectedAbilityId: abilityId } }),
    cancelTileTargeting: () => set({ tileTargetMode: inactiveTileTargetMode() }),
  };
}

export const useGameStore = create<GameStore>((set, get) => createGameStore(set, get));
