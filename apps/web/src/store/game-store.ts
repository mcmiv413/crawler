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

export const useGameStore = create<GameStore>((set, get) => ({
  gameId: null,
  view: null,
  combatLog: [],
  loading: false,
  error: null,
  autoWalkPath: [],
  autoWalkKnownEnemyIds: new Set(),
  debugLogging: false,

  createGame: async (seed, playerName) => {
    set({ loading: true, error: null });
    try {
      const api = await import('../api/client.js');
      const result = await api.createGame(seed, playerName);
      saveSession(result.gameId, result.serializedState);
      set({
        gameId: result.gameId,
        view: result.view,
        combatLog: [],
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  sendCommand: async (command) => {
    const { gameId, debugLogging } = get();
    if (!gameId) return;

    set({ loading: true, error: null });
    try {
      const api = await import('../api/client.js');
      if (debugLogging && (command as Record<string, unknown>).type === 'ATTACK') {
        console.log('[DEBUG] Attack Command:', {
          playerAccuracy: get().view?.player?.accuracy,
          playerAttack: get().view?.player?.attack,
          command,
          timestamp: new Date().toISOString(),
        });
      }
      let result: Awaited<ReturnType<typeof api.sendCommand>>;
      try {
        result = await api.sendCommand(gameId, command);
      } catch (err) {
        if (err instanceof api.GameNotFoundError) {
          // Server lost state (cold start) — restore and retry
          const saved = loadSession();
          if (saved) {
            await api.restoreGame(saved.serializedState);
            result = await api.sendCommand(gameId, command);
          } else {
            throw new Error('Game session expired. Please start a new game.');
          }
        } else {
          throw err;
        }
      }
      saveSession(gameId, result.serializedState);
      if (debugLogging && result.view.combatLog.length > 0) {
        const lastEntry = result.view.combatLog[result.view.combatLog.length - 1];
        console.log('[DEBUG] Combat Result:', {
          lastLogEntry: lastEntry?.text,
          playerHealth: result.view.player.health,
          timestamp: new Date().toISOString(),
        });
      }
      set({
        view: result.view,
        combatLog: [...get().combatLog, ...result.view.combatLog].slice(-50),
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  refreshView: async () => {
    const { gameId } = get();
    if (!gameId) return;

    try {
      const api = await import('../api/client.js');
      const view = await api.fetchGameView(gameId);
      set({ view });
    } catch (err) {
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
        const view = await api.fetchGameView(saved.gameId);
        set({ gameId: saved.gameId, view, combatLog: [], loading: false });
        return true;
      } catch {
        // Server lost it (cold start) — restore from client state
      }
      const result = await api.restoreGame(saved.serializedState);
      saveSession(result.gameId, result.serializedState);
      set({ gameId: result.gameId, view: result.view, combatLog: [], loading: false });
      return true;
    } catch {
      // Saved state is corrupted or incompatible — clear and start fresh
      clearSession();
      set({ loading: false });
      return false;
    }
  },

  resetGame: () => {
    clearSession();
    set({ gameId: null, view: null, combatLog: [], error: null, autoWalkPath: [], autoWalkKnownEnemyIds: new Set() });
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
