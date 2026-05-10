import { create } from 'zustand';
import type { GameView, CombatLogEntry } from '@dungeon/presenter';
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

let deathTransitionTimeout: ReturnType<typeof setTimeout> | null = null;

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

export const useGameStore = create<GameStore>((set, get) => ({
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

  createGame: async (seed, playerName) => {
    set({ loading: true, error: null });
    try {
      const api = await import('../api/client.js');
      const result = await api.createGame(seed, playerName);
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
  },

  sendCommand: async (command) => {
    const { gameId, sessionToken, debugLogging } = get();
    if (!gameId) return;

    set({ loading: true, error: null });
    try {
      const api = await import('../api/client.js');
      if (debugLogging && (command as Record<string, unknown>).type === 'ATTACK') {
        // eslint-disable-next-line no-console
        console.log('[DEBUG] Attack Command:', {
          playerAccuracy: get().view?.player?.accuracy,
          playerAttack: get().view?.player?.attack,
          command,
          timestamp: new Date().toISOString(),
        });
      }
      let result: Awaited<ReturnType<typeof api.sendCommand>>;
      let currentSessionToken = sessionToken ?? undefined;
      try {
        result = await api.sendCommand(gameId, command, currentSessionToken);
      } catch (err) {
        if (err instanceof api.GameNotFoundError) {
          // Server lost state (cold start) — restore and retry
          const saved = loadSession();
          if (saved) {
            const restored = await api.restoreGame(saved.serializedState, saved.sessionToken);
            currentSessionToken = restored.sessionToken;
            set({ sessionToken: currentSessionToken });
            result = await api.sendCommand(gameId, command, restored.sessionToken);
          } else {
            throw new Error('Game session expired. Please start a new game.');
          }
        } else {
          throw err;
        }
      }
      saveSession(gameId, result.serializedState, currentSessionToken);
      if (debugLogging && result.view.combatLog.length > 0) {
        const lastEntry = result.view.combatLog[result.view.combatLog.length - 1];
        // eslint-disable-next-line no-console
        console.log('[DEBUG] Combat Result:', {
          lastLogEntry: lastEntry?.text,
          playerHealth: result.view.player.health,
          timestamp: new Date().toISOString(),
        });
      }
      const currentView = get().view;
      const viewWithOptionalFields = result.view as Partial<typeof result.view>;
      const dungeonToEndPhase =
        currentView?.phase === 'dungeon' &&
        (result.view.phase === 'town' || result.view.phase === 'game_over');
      const hasDeathSignal =
        !!viewWithOptionalFields.deathContext?.killerName ||
        viewWithOptionalFields.runResult === 'permadeath';
      const isDeath = dungeonToEndPhase && hasDeathSignal;

      if (isDeath) {
        if (deathTransitionTimeout) clearTimeout(deathTransitionTimeout);

        set({
          combatLog: [...get().combatLog, ...result.view.combatLog].slice(-50),
          deathTransitioning: true,
          loading: false,
        });

        deathTransitionTimeout = setTimeout(() => {
          set({
            view: result.view,
            deathTransitioning: false,
          });
          deathTransitionTimeout = null;
        }, 2000);
      } else {
        if (deathTransitionTimeout) clearTimeout(deathTransitionTimeout);
        deathTransitionTimeout = null;
        set({
          view: result.view,
          combatLog: [...get().combatLog, ...result.view.combatLog].slice(-50),
          loading: false,
          deathTransitioning: false,
        });
      }
    } catch (err) {
      if (shouldClearSavedSession(err)) {
        clearSession();
        set({ sessionToken: null });
      }
      set({ error: (err as Error).message, loading: false });
    }
  },

  refreshView: async () => {
    const { gameId, sessionToken } = get();
    if (!gameId) return;

    try {
      const api = await import('../api/client.js');
      const view = await api.fetchGameView(gameId, sessionToken ?? undefined);
      set({ view });
    } catch (err) {
      if (shouldClearSavedSession(err)) {
        clearSession();
        set({ sessionToken: null });
      }
      set({ error: (err as Error).message });
    }
  },

  clearError: () => set({ error: null }),

  restoreSession: async () => {
    const saved = loadSession();
    if (!saved) return false;

    set({ loading: true, error: null });
    try {
      const api = await import('../api/client.js');
      // Try fetching view directly (server may still have it warm)
      try {
        const view = await api.fetchGameView(saved.gameId, saved.sessionToken);
        set({ gameId: saved.gameId, view, combatLog: [], loading: false, sessionToken: saved.sessionToken ?? null });
        return true;
      } catch {
        // Server lost it (cold start) — restore from client state
      }
      const result = await api.restoreGame(saved.serializedState, saved.sessionToken);
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
  },

  resetGame: () => {
    if (deathTransitionTimeout) clearTimeout(deathTransitionTimeout);
    deathTransitionTimeout = null;
    clearSession();
    set({ gameId: null, view: null, combatLog: [], error: null, autoWalkPath: [], autoWalkKnownEnemyIds: new Set(), deathTransitioning: false, sessionToken: null });
  },

  startAutoWalk: (path) => {
    const view = get().view;
    const knownEnemyIds = new Set<string>();
    if (view?.map) {
      for (const entity of view.map.entities) {
        if (entity.type === 'enemy') knownEnemyIds.add(entity.id);
      }
    }
    set({ autoWalkPath: path, autoWalkKnownEnemyIds: knownEnemyIds });
  },

  cancelAutoWalk: () => set({ autoWalkPath: [], autoWalkKnownEnemyIds: new Set() }),

  toggleDebugLogging: async () => {
    await get().sendCommand({ type: 'TOGGLE_DEBUG' });
  },
}));
