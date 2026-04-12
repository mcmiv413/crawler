import { create } from 'zustand';
import type { GameView, CombatLogEntry } from '@dungeon/presenter';

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
  clearError: () => void;
  startAutoWalk: (path: Position[]) => void;
  cancelAutoWalk: () => void;
  toggleDebugLogging: () => void;
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
      const result = await api.sendCommand(gameId, command);
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
