/**
 * Game Store Tests (Zustand)
 *
 * Comprehensive tests for the game store covering:
 * - createGame: success and error paths
 * - sendCommand: success, GameNotFoundError recovery, and error handling
 * - refreshView: view updates without losing gameId
 * - restoreSession: warm start, cold start, and corruption handling
 * - combatLog: size capping at 50 entries
 * - autoWalk: path and enemy ID tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { GameView, CombatLogEntry } from '@dungeon/presenter';
import { buildGameView } from '@dungeon/presenter';
import { useGameStore } from './game-store.js';
import * as sessionPersistence from './session-persistence.js';

// Mock session persistence
vi.mock('./session-persistence.js', () => ({
  saveSession: vi.fn(),
  loadSession: vi.fn(),
  clearSession: vi.fn(),
}));

// Mock API module
vi.mock('../api/client.js');

// Helper to create a minimal but valid GameView
function createMockGameView(overrides?: Partial<GameView>): GameView {
  const baseView: GameView = {
    gameId: 'test-game-1',
    phase: 'dungeon',
    player: {
      name: 'TestHero',
      level: 1,
      health: 50,
      maxHealth: 100,
      attack: 10,
      defense: 5,
      accuracy: 80,
      evasion: 20,
      speed: 1,
      resistances: {},
      gold: 100,
      floor: 1,
      experience: 0,
      statuses: [],
      abilities: [],
      weaponMastery: null,
      experienceForNextLevel: 100,
      biomeId: null,
      biomeColor: '#888888',
      equippedItems: [],
      statBreakdowns: {},
      activeQuests: [],
      nemesisInfo: null,
      factionStandings: [],
    },
    map: {
      width: 20,
      height: 10,
      dangerLevel: 'moderate',
      playerPosition: { x: 5, y: 5 },
      biomeId: 'dungeon',
      cells: [],
      entities: [],
    },
    combatLog: [],
    availableActions: [],
    town: null,
    inventory: {
      items: [],
      equipped: {
        weapon: null,
        secondaryWeapon: null,
        chest: null,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
      },
    },
    activeQuests: [],
    runResult: null,
    deathStashFloor: null,
    deathSummary: null,
    deathContext: null,
    inspectableEntities: [],
    recentlyDefeatedNemesis: null,
    debugMode: false,
    animatedEvents: [],
  };

  return { ...baseView, ...overrides };
}

// Helper to create a mock log entry
function createMockLogEntry(text: string = 'Test log entry'): CombatLogEntry {
  return {
    timestamp: Date.now(),
    text,
    type: 'info',
  };
}

describe('useGameStore (Zustand)', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Reset store state
    const { result } = renderHook(() => useGameStore());
    act(() => {
      result.current.resetGame();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // createGame() Tests (2 tests)
  // ============================================================================

  describe('createGame', () => {
    it('success: POST /api/games → state updates (gameId, view, loading cleared)', async () => {
      const mockGameId = 'game-abc123';
      const mockView = createMockGameView({ gameId: mockGameId });
      const serializedState = 'state-serialized-123';

      // Mock the API
      const { createGame: mockCreateGame } = await import('../api/client.js');
      vi.mocked(mockCreateGame).mockResolvedValueOnce({
        gameId: mockGameId,
        view: mockView,
        serializedState,
      });

      const { result } = renderHook(() => useGameStore());

      // Verify initial state
      expect(result.current.gameId).toBeNull();
      expect(result.current.view).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();

      // Call createGame
      await act(async () => {
        await result.current.createGame(42, 'TestPlayer');
      });

      // Verify state updates
      expect(result.current.gameId).toBe(mockGameId);
      expect(result.current.view).not.toBeNull();
      expect(result.current.view?.gameId).toBe(mockGameId);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.combatLog).toHaveLength(0);

      // Verify saveSession was called
      expect(sessionPersistence.saveSession).toHaveBeenCalledWith(mockGameId, serializedState);
    });

    it('error: Network failure → error state set, gameId remains null', async () => {
      const errorMessage = 'Network error: unable to reach server';

      // Mock the API to reject
      const { createGame: mockCreateGame } = await import('../api/client.js');
      vi.mocked(mockCreateGame).mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useGameStore());

      // Call createGame
      await act(async () => {
        await result.current.createGame();
      });

      // Verify error state
      expect(result.current.gameId).toBeNull();
      expect(result.current.view).toBeNull();
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.loading).toBe(false);
    });
  });

  // ============================================================================
  // sendCommand() Tests (3 tests)
  // ============================================================================

  describe('sendCommand', () => {
    it('success: Command sent → view updated, combatLog appended, events merged', async () => {
      const mockGameId = 'game-cmd-123';
      const initialView = createMockGameView({ gameId: mockGameId });
      const newLogEntry = createMockLogEntry('Attack hit for 15 damage!');
      const updatedView = createMockGameView({
        gameId: mockGameId,
        combatLog: [newLogEntry],
        player: { ...initialView.player, health: 35 },
      });

      // Set up initial state
      const { result } = renderHook(() => useGameStore());
      act(() => {
        result.current.resetGame();
      });

      const { sendCommand: mockSendCommand } = await import('../api/client.js');
      vi.mocked(mockSendCommand).mockResolvedValueOnce({
        view: updatedView as unknown as GameView & { combatLog: CombatLogEntry[] },
        events: [],
        runEnded: false,
        serializedState: 'state-cmd-123',
      });

      // Manually set gameId and view (simulating a running game)
      act(() => {
        useGameStore.setState({ gameId: mockGameId, view: initialView });
      });

      const command = { type: 'ATTACK', targetId: 'enemy-1' };

      // Send command
      await act(async () => {
        await result.current.sendCommand(command);
      });

      // Verify view was updated
      expect(result.current.view?.gameId).toBe(mockGameId);
      expect(result.current.view?.player.health).toBeLessThan(initialView.player.health);

      // Verify combatLog was appended
      expect(result.current.combatLog).toHaveLength(1);
      expect(result.current.combatLog[0]?.text).toBe('Attack hit for 15 damage!');

      // Verify state and loading cleared
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('GameNotFoundError recovery: 404 → loads session → retries → succeeds', async () => {
      const mockGameId = 'game-recovery-123';
      const serializedState = 'recovered-state';
      const recoveredView = createMockGameView({ gameId: mockGameId });

      const { result } = renderHook(() => useGameStore());

      // Mock session persistence
      vi.mocked(sessionPersistence.loadSession).mockReturnValueOnce({
        gameId: mockGameId,
        serializedState,
      });

      // Mock API: first call throws 404, second call succeeds
      const { sendCommand: mockSendCommand, restoreGame: mockRestoreGame, GameNotFoundError } =
        await import('../api/client.js');

      vi.mocked(mockSendCommand)
        .mockRejectedValueOnce(new GameNotFoundError(mockGameId))
        .mockResolvedValueOnce({
          view: recoveredView as unknown as GameView & { combatLog: CombatLogEntry[] },
          events: [],
          runEnded: false,
          serializedState,
        });

      vi.mocked(mockRestoreGame).mockResolvedValueOnce({
        gameId: mockGameId,
        view: recoveredView,
        serializedState,
      });

      // Set up initial state
      act(() => {
        useGameStore.setState({ gameId: mockGameId, view: createMockGameView() });
      });

      const command = { type: 'MOVE', direction: 'north' };

      // Send command (should trigger recovery flow)
      await act(async () => {
        await result.current.sendCommand(command);
      });

      // Verify recovery path was taken
      expect(sessionPersistence.loadSession).toHaveBeenCalled();
      expect(vi.mocked(mockRestoreGame)).toHaveBeenCalledWith(serializedState);

      // Verify final state is consistent
      expect(result.current.gameId).toBe(mockGameId);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('error handling: Other errors → error state set', async () => {
      const mockGameId = 'game-error-123';
      const errorMessage = 'Invalid command payload';

      const { result } = renderHook(() => useGameStore());

      // Mock API to throw a non-GameNotFoundError
      const { sendCommand: mockSendCommand } = await import('../api/client.js');
      vi.mocked(mockSendCommand).mockRejectedValueOnce(new Error(errorMessage));

      // Set up initial state
      act(() => {
        useGameStore.setState({ gameId: mockGameId, view: createMockGameView() });
      });

      const command = { type: 'USE_ITEM', itemId: 'invalid' };

      // Send command
      await act(async () => {
        await result.current.sendCommand(command);
      });

      // Verify error state
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.loading).toBe(false);
      expect(result.current.gameId).toBe(mockGameId); // gameId should persist
    });
  });

  // ============================================================================
  // refreshView() Tests (1 test)
  // ============================================================================

  describe('refreshView', () => {
    it('GET /api/games/:id/view → view updated without losing gameId', async () => {
      const mockGameId = 'game-refresh-123';
      const initialView = createMockGameView({ gameId: mockGameId });
      const updatedView = createMockGameView({
        gameId: mockGameId,
        player: { ...initialView.player, health: 25 },
      });

      const { result } = renderHook(() => useGameStore());

      // Set up initial state
      act(() => {
        useGameStore.setState({ gameId: mockGameId, view: initialView });
      });

      // Mock API
      const { fetchGameView: mockFetchGameView } = await import('../api/client.js');
      vi.mocked(mockFetchGameView).mockResolvedValueOnce(updatedView);

      // Call refreshView
      await act(async () => {
        await result.current.refreshView();
      });

      // Verify gameId is preserved
      expect(result.current.gameId).toBe(mockGameId);

      // Verify view was updated
      expect(result.current.view?.player.health).toBeLessThan(initialView.player.health);
    });
  });

  // ============================================================================
  // restoreSession() Tests (2 tests)
  // ============================================================================

  describe('restoreSession', () => {
    it('warm start: Fetch from server succeeds → gameId, view, combatLog populated', async () => {
      const mockGameId = 'game-warm-123';
      const serializedState = 'warm-state';
      const restoredView = createMockGameView({ gameId: mockGameId });

      const { result } = renderHook(() => useGameStore());

      // Mock session persistence
      vi.mocked(sessionPersistence.loadSession).mockReturnValueOnce({
        gameId: mockGameId,
        serializedState,
      });

      // Mock API: fetchGameView succeeds (warm start)
      const { fetchGameView: mockFetchGameView } = await import('../api/client.js');
      vi.mocked(mockFetchGameView).mockResolvedValueOnce(restoredView);

      // Call restoreSession
      let restored = false;
      await act(async () => {
        restored = await result.current.restoreSession();
      });

      // Verify success
      expect(restored).toBe(true);
      expect(result.current.gameId).toBe(mockGameId);
      expect(result.current.view).not.toBeNull();
      expect(result.current.view?.gameId).toBe(mockGameId);
      expect(result.current.combatLog).toHaveLength(0);
      expect(result.current.loading).toBe(false);
    });

    it('cold start: Fallback to restoreGame → restores state OR clears on corruption', async () => {
      const mockGameId = 'game-cold-123';
      const serializedState = 'cold-state';
      const restoredView = createMockGameView({ gameId: mockGameId });

      const { result } = renderHook(() => useGameStore());

      // Mock session persistence
      vi.mocked(sessionPersistence.loadSession).mockReturnValueOnce({
        gameId: mockGameId,
        serializedState,
      });

      // Mock API: fetchGameView fails, but restoreGame succeeds (cold start)
      const { fetchGameView: mockFetchGameView, restoreGame: mockRestoreGame } =
        await import('../api/client.js');
      vi.mocked(mockFetchGameView).mockRejectedValueOnce(new Error('Server lost state'));
      vi.mocked(mockRestoreGame).mockResolvedValueOnce({
        gameId: mockGameId,
        view: restoredView,
        serializedState,
      });

      // Call restoreSession
      let restored = false;
      await act(async () => {
        restored = await result.current.restoreSession();
      });

      // Verify cold start succeeded
      expect(restored).toBe(true);
      expect(result.current.gameId).toBe(mockGameId);
      expect(result.current.view).not.toBeNull();
      expect(vi.mocked(mockRestoreGame)).toHaveBeenCalledWith(serializedState);
    });

    it('corruption handling: Both fetch and restore fail → session cleared, returns false', async () => {
      const mockGameId = 'game-corrupt-123';
      const serializedState = 'corrupt-state';

      const { result } = renderHook(() => useGameStore());

      // Mock session persistence
      vi.mocked(sessionPersistence.loadSession).mockReturnValueOnce({
        gameId: mockGameId,
        serializedState,
      });

      // Mock API: both calls fail
      const { fetchGameView: mockFetchGameView, restoreGame: mockRestoreGame } =
        await import('../api/client.js');
      vi.mocked(mockFetchGameView).mockRejectedValueOnce(new Error('Server error'));
      vi.mocked(mockRestoreGame).mockRejectedValueOnce(new Error('Corrupt state'));

      // Call restoreSession
      let restored = false;
      await act(async () => {
        restored = await result.current.restoreSession();
      });

      // Verify session was cleared
      expect(restored).toBe(false);
      expect(sessionPersistence.clearSession).toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    it('no saved session: loadSession returns null → restoreSession returns false', async () => {
      const { result } = renderHook(() => useGameStore());

      // Mock session persistence to return null
      vi.mocked(sessionPersistence.loadSession).mockReturnValueOnce(null);

      // Call restoreSession
      let restored = false;
      await act(async () => {
        restored = await result.current.restoreSession();
      });

      // Verify early return
      expect(restored).toBe(false);
      expect(result.current.gameId).toBeNull();
    });
  });

  // ============================================================================
  // combatLog slicing Tests (1 test)
  // ============================================================================

  describe('combatLog', () => {
    it('combatLog never exceeds 50 entries (old entries dropped)', async () => {
      const mockGameId = 'game-log-123';
      const mockView = createMockGameView({ gameId: mockGameId });

      const { result } = renderHook(() => useGameStore());

      // Set up initial state with many log entries
      const initialLogs = Array.from({ length: 45 }, (_, i) => createMockLogEntry(`Entry ${i}`));
      act(() => {
        useGameStore.setState({ gameId: mockGameId, view: mockView, combatLog: initialLogs });
      });

      expect(result.current.combatLog).toHaveLength(45);

      // Mock API
      const { sendCommand: mockSendCommand } = await import('../api/client.js');
      const newLogs = Array.from({ length: 10 }, (_, i) => createMockLogEntry(`New Entry ${i}`));
      vi.mocked(mockSendCommand).mockResolvedValueOnce({
        view: { ...mockView, combatLog: newLogs },
        events: [],
        runEnded: false,
        serializedState: 'state-log',
      });

      // Send command which adds logs
      await act(async () => {
        await result.current.sendCommand({ type: 'ATTACK', targetId: 'enemy-1' });
      });

      // Verify log is capped at 50
      expect(result.current.combatLog.length).toBeLessThanOrEqual(50);
      // Should have 50 items (45 + 10 = 55, sliced to 50)
      expect(result.current.combatLog).toHaveLength(50);

      // Verify old entries were dropped (first 5 entries from initial 45)
      expect(result.current.combatLog[0]?.text).toBe('Entry 5');
      // Verify new entries are present
      expect(result.current.combatLog[49]?.text).toBe('New Entry 9');
    });
  });

  // ============================================================================
  // autoWalk Tests (1 test)
  // ============================================================================

  describe('autoWalk', () => {
    it('startAutoWalk creates Set from map entities, cancelAutoWalk clears it', () => {
      const { result } = renderHook(() => useGameStore());

      // Create a view with multiple enemies
      const mockView = createMockGameView({
        map: {
          width: 20,
          height: 10,
          dangerLevel: 'moderate',
          playerPosition: { x: 5, y: 5 },
          biomeId: 'dungeon',
          cells: [],
          entities: [
            { id: 'enemy-1', type: 'enemy' as const, x: 10, y: 5, ascii: 'E', color: '#f00', name: 'Enemy', templateId: 'enemy' },
            { id: 'enemy-2', type: 'enemy' as const, x: 12, y: 6, ascii: 'E', color: '#f00', name: 'Enemy', templateId: 'enemy' },
            { id: 'ally-1', type: 'object' as const, x: 8, y: 7, ascii: 'A', color: '#0f0', name: 'Ally', templateId: null },
          ],
        },
      });

      // Set up state
      act(() => {
        useGameStore.setState({ view: mockView });
      });

      // Call startAutoWalk with a path
      const path = [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 7, y: 5 },
      ];

      act(() => {
        result.current.startAutoWalk(path);
      });

      // Verify path and enemy IDs are set
      expect(result.current.autoWalkPath).toEqual(path);
      expect(result.current.autoWalkKnownEnemyIds.size).toBe(2);
      expect(result.current.autoWalkKnownEnemyIds.has('enemy-1')).toBe(true);
      expect(result.current.autoWalkKnownEnemyIds.has('enemy-2')).toBe(true);
      expect(result.current.autoWalkKnownEnemyIds.has('ally-1')).toBe(false);

      // Call cancelAutoWalk
      act(() => {
        result.current.cancelAutoWalk();
      });

      // Verify both are cleared
      expect(result.current.autoWalkPath).toHaveLength(0);
      expect(result.current.autoWalkKnownEnemyIds.size).toBe(0);
    });
  });

  // ============================================================================
  // State mutation and error clearing Tests
  // ============================================================================

  describe('error and state management', () => {
    it('clearError clears error state', () => {
      const { result } = renderHook(() => useGameStore());

      // Set an error
      act(() => {
        useGameStore.setState({ error: 'Some error' });
      });

      expect(result.current.error).toBe('Some error');

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('resetGame clears all state and calls clearSession', () => {
      const { result } = renderHook(() => useGameStore());

      // Set up a populated state
      act(() => {
        useGameStore.setState({
          gameId: 'game-123',
          view: createMockGameView(),
          combatLog: [createMockLogEntry()],
          error: 'some error',
          autoWalkPath: [{ x: 1, y: 1 }],
          autoWalkKnownEnemyIds: new Set(['enemy-1']),
        });
      });

      // Reset
      act(() => {
        result.current.resetGame();
      });

      // Verify all state is cleared
      expect(result.current.gameId).toBeNull();
      expect(result.current.view).toBeNull();
      expect(result.current.combatLog).toHaveLength(0);
      expect(result.current.error).toBeNull();
      expect(result.current.autoWalkPath).toHaveLength(0);
      expect(result.current.autoWalkKnownEnemyIds.size).toBe(0);

      // Verify clearSession was called
      expect(sessionPersistence.clearSession).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Early return conditions
  // ============================================================================

  describe('early return conditions', () => {
    it('sendCommand without gameId returns early', async () => {
      const { result } = renderHook(() => useGameStore());

      // Verify gameId is null
      expect(result.current.gameId).toBeNull();

      // Call sendCommand
      await act(async () => {
        await result.current.sendCommand({ type: 'ATTACK', targetId: 'enemy-1' });
      });

      // Verify API was not called
      const { sendCommand: mockSendCommand } = await import('../api/client.js');
      expect(vi.mocked(mockSendCommand)).not.toHaveBeenCalled();
    });

    it('refreshView without gameId returns early', async () => {
      const { result } = renderHook(() => useGameStore());

      // Verify gameId is null
      expect(result.current.gameId).toBeNull();

      // Call refreshView
      await act(async () => {
        await result.current.refreshView();
      });

      // Verify API was not called
      const { fetchGameView: mockFetchGameView } = await import('../api/client.js');
      expect(vi.mocked(mockFetchGameView)).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // debugLogging smoke tests
  // ============================================================================

  describe('debugLogging', () => {
    it('toggleDebugLogging calls sendCommand with TOGGLE_DEBUG type', async () => {
      const { result } = renderHook(() => useGameStore());

      // Set up a game state
      act(() => {
        useGameStore.setState({
          gameId: 'game-123',
          view: createMockGameView(),
        });
      });

      // Mock sendCommand
      const { sendCommand: mockSendCommand } = await import('../api/client.js');
      vi.mocked(mockSendCommand).mockResolvedValueOnce({
        view: createMockGameView() as unknown as GameView & { combatLog: CombatLogEntry[] },
        events: [],
        runEnded: false,
        serializedState: 'state',
      });

      // Call toggleDebugLogging
      await act(async () => {
        await result.current.toggleDebugLogging();
      });

      // Verify sendCommand was called with TOGGLE_DEBUG
      expect(vi.mocked(mockSendCommand)).toHaveBeenCalledWith('game-123', {
        type: 'TOGGLE_DEBUG',
      });
    });
  });
});
