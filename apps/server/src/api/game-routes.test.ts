/**
 * Test layer: unit
 * Behavior: Game Routes covers Game Routes; POST apigames; creates a new game and returns 201 with gameId, view, and serializedState.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/server/src/api/game-routes.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { deserializeState, serializeState } from '@dungeon/core';
import { createTestEnemy, createTestGameStateInCombat } from '@dungeon/core/testing';
import { entityId } from '@dungeon/contracts';
import type { DomainEvent, EntityId, GameCommand, GameState, IGameRepository, RunMetrics } from '@dungeon/contracts';

function createRepoStub(overrides: Partial<IGameRepository> = {}): IGameRepository {
  return {
    createGame: vi.fn(() => Promise.resolve()),
    loadGame: vi.fn(() => Promise.resolve(null)),
    saveGame: vi.fn(() => Promise.resolve()),
    appendEvents: vi.fn(() => Promise.resolve()),
    getRecentEvents: vi.fn(() => Promise.resolve([] as readonly DomainEvent[])),
    recordRunMetrics: vi.fn((_metrics: RunMetrics, _gameId?: string) => undefined),
    getRunMetricsLog: vi.fn(() => [] as readonly RunMetrics[]),
    commitTick: vi.fn(() => Promise.resolve()),
    setGameSessionToken: vi.fn(() => Promise.resolve()),
    getGameSessionToken: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  };
}

function sessionHeaders(sessionToken: string): Record<string, string> {
  return { 'x-dungeon-session': sessionToken };
}

function createStoredFloorSnapshot(state: GameState) {
  if (state.run === null) {
    throw new Error('Expected an active run');
  }

  return {
    floor: state.run.floor,
    enemies: state.run.enemies,
    objects: state.run.objects,
    playerPosition: state.player.position,
    originalEnemyCount: state.run.enemies.size,
    lastSimulatedTurn: 19,
  };
}

describe('Game Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/games', () => {
    it('creates a new game and returns 201 with gameId, view, and serializedState', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          playerName: 'TestHero',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Verify response structure
      expect(body).toHaveProperty('gameId');
      expect(body).toHaveProperty('view');
      expect(body).toHaveProperty('serializedState');

      // Verify gameId is a string
      expect(typeof body.gameId).toBe('string');
      expect(body.gameId.length).toBeGreaterThan(0);

      // Verify view structure
      expect(body.view).toHaveProperty('player');
      expect(body.view.player).toBeDefined();

      // Verify serializedState is a string (compressed state)
      expect(typeof body.serializedState).toBe('string');

      // Verify Content-Type header
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('creates a new game with optional seed parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          playerName: 'Seeded',
          seed: 12345,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      const state = deserializeState(body.serializedState);
      expect(body.gameId).toBeDefined();
      expect(body.view).toBeDefined();
      expect(state.seed).toBe(12345);
    });

    it('handles missing body gracefully and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {},
      });

      // Even with empty body, should succeed with defaults
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      const state = deserializeState(body.serializedState);
      expect(body.gameId).toBeDefined();
      expect(typeof state.seed).toBe('number');
    });

    it('returns valid response when no playerName provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.gameId).toBeDefined();
      expect(body.view).toBeDefined();
    });
  });

  describe('POST /api/games/:id/commands', () => {
    let gameId: EntityId;
    let sessionToken: string;

    beforeEach(async () => {
      // Create game through app API so it's stored in app's internal repo
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      gameId = createBody.gameId as EntityId;
      sessionToken = createBody.sessionToken;
    });

    it('submits a valid command and returns 200 with updated view', async () => {
      const command: GameCommand = {
        type: 'WAIT',
      };

      const response = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: command,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Verify response structure
      expect(body).toHaveProperty('view');
      expect(body).toHaveProperty('events');
      expect(body).toHaveProperty('runEnded');
      expect(body).toHaveProperty('serializedState');

      // Verify view contains expected data
      expect(body.view).toHaveProperty('player');

      // Verify events is an array
      expect(Array.isArray(body.events)).toBe(true);

      // Verify runEnded is boolean
      expect(typeof body.runEnded).toBe('boolean');

      // Verify serializedState is a string
      expect(typeof body.serializedState).toBe('string');
    });

    it('returns 400 with invalid command type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: {
          type: 'INVALID_COMMAND_TYPE',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('returns 400 when required command fields are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: {
          // Missing 'type' field
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('returns 404 when game does not exist', async () => {
      const fakeGameId = 'nonexistent-game-id';
      const response = await app.inject({
        method: 'POST',
        url: `/api/games/${fakeGameId}/commands`,
        payload: {
          type: 'WAIT',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('persists state after command submission', async () => {
      const command: GameCommand = {
        type: 'WAIT',
      };

      await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: command,
      });

      // Fetch game state after command
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
        headers: sessionHeaders(sessionToken),
      });

      expect(getResponse.statusCode).toBe(200);
      const viewBody = JSON.parse(getResponse.body);
      expect(viewBody).toHaveProperty('player');
      expect(viewBody.player).toBeDefined();
    });

    it('applies run consequences exactly once on victory', async () => {
      const baseState = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
      const boss = createTestEnemy({
        id: entityId('dungeon_ogre'),
        templateId: 'dungeon_ogre',
        name: 'Dungeon Ogre',
        position: { x: 1, y: 0 },
        tier: 5,
        stats: {
          maxHealth: 1,
          health: 1,
          attack: 8,
          defense: 0,
          accuracy: 70,
          evasion: 0,
          speed: 120,
        },
      });

      const victoryState: GameState = {
        ...baseState,
        player: {
          ...baseState.player,
          position: { x: 0, y: 0 },
          floor: 5,
          stats: {
            ...baseState.player.stats,
            attack: 9999,
          },
        },
        world: {
          ...baseState.world,
          dungeonOgre: {
            id: 'dungeon_ogre',
            status: 'emerged' as const,
            emergedAfterRun: 1,
            emergedAtDepth: 5,
            eligibleSpawnDepths: [5, 6, 7],
            selectedSpawnDepth: 5,
          },
        },
        run: {
          ...baseState.run!,
          floor: {
            ...baseState.run!.floor,
            depth: 5,
          },
          enemies: new Map([['1,0', boss]]),
        },
      };

      const restoreResponse = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        payload: { serializedState: serializeState(victoryState) },
      });
      expect(restoreResponse.statusCode).toBe(200);
      const restoreBody = JSON.parse(restoreResponse.body);

      const attackResponse = await app.inject({
        method: 'POST',
        url: `/api/games/${victoryState.gameId}/commands`,
        headers: sessionHeaders(restoreBody.sessionToken),
        payload: {
          type: 'ATTACK',
          targetId: boss.id,
        },
      });

      expect(attackResponse.statusCode).toBe(200);
      const attackBody = JSON.parse(attackResponse.body);
      const finalState = deserializeState(attackBody.serializedState);

      expect(attackBody.runEnded).toBe(true);
      expect(finalState.phase).toBe('game_over');
      expect(finalState.run?.runMetrics?.causeOfEnd).toBe('victory');
      expect(finalState.world.totalRuns).toBe(1);
    });
  });

  describe('GET /api/games/:id/view', () => {
    let gameId: EntityId;
    let sessionToken: string;

    beforeEach(async () => {
      // Create game through app API
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      gameId = createBody.gameId as EntityId;
      sessionToken = createBody.sessionToken;
    });

    it('returns 200 with current GameView when game exists', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
        headers: sessionHeaders(sessionToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Verify view structure
      expect(body).toHaveProperty('player');
      expect(body).toHaveProperty('combatLog');

      // Verify player data exists
      expect(body.player).toBeDefined();
      // Player should have at least name and level
      expect(body.player.name).toBeDefined();
      expect(body.player.level).toBeDefined();

      // Verify combatLog is an array
      expect(Array.isArray(body.combatLog)).toBe(true);
    });

    it('returns 404 when game does not exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/games/nonexistent-game-id/view',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('includes recent events in combatLog', async () => {
      // Submit a command to generate events
      const commandResponse = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: { type: 'WAIT' },
      });
      expect(commandResponse.statusCode).toBe(200);

      // Get updated view
      const viewResponse = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
        headers: sessionHeaders(sessionToken),
      });

      expect(viewResponse.statusCode).toBe(200);
      const body = JSON.parse(viewResponse.body);
      expect(body).toHaveProperty('combatLog');
      expect(Array.isArray(body.combatLog)).toBe(true);
    });
  });

  describe('GET /api/games/:id', () => {
    let gameId: EntityId;
    let sessionToken: string;

    beforeEach(async () => {
      // Create game through app API
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      gameId = createBody.gameId as EntityId;
      sessionToken = createBody.sessionToken;
    });

    it('returns 200 with GameView (alias for /view endpoint)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}`,
        headers: sessionHeaders(sessionToken),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('player');
      expect(body).toHaveProperty('combatLog');
    });

    it('returns 404 for nonexistent game', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/games/nonexistent-game-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });
  });

  describe('POST /api/games/restore', () => {
    it('restores a game from serialized state and returns 200 with restored view', async () => {
      // Create and get serialized state
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'Player1' },
      });
      const createBody = JSON.parse(createResponse.body);
      const serializedState = createBody.serializedState;

      // Restore the game
      const restoreResponse = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        headers: sessionHeaders(createBody.sessionToken),
        payload: { serializedState },
      });

      expect(restoreResponse.statusCode).toBe(200);
      const restoreBody = JSON.parse(restoreResponse.body);
      expect(restoreBody).toHaveProperty('gameId');
      expect(restoreBody).toHaveProperty('view');
      expect(restoreBody.serializedState).toBe(serializedState);
    });

    it('returns 400 when serializedState is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.code).toBe('MISSING_SERIALIZED_STATE');
    });

    it('returns 400 when serializedState is not a string', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        payload: { serializedState: 12345 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('returns 400 when serializedState is malformed', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        payload: { serializedState: 'not-a-valid-state' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.code).toBe('INVALID_SAVE_FILE');
    });

    it('returns 400 when restored state has invalid content and item references', async () => {
      const state = createTestGameStateInCombat();
      const invalidState: GameState = {
        ...state,
        player: {
          ...state.player,
          learnedRingSpellIds: ['made_up_spell'],
          equipment: {
            ...state.player.equipment,
            chest: entityId('missing_equipment_entity'),
          },
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        payload: { serializedState: serializeState(invalidState) },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_SAVE_FILE');
      expect(body.message).toBe('The submitted save file could not be parsed or validated.');
      expect(body.message).not.toContain('learnedRingSpellIds.made_up_spell');
      expect(body.message).not.toContain('player.equipment.chest');
    });

    it('returns existing game when the submitted save matches the stored state', async () => {
      // Create a game
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'Player1' },
      });
      const createBody = JSON.parse(createResponse.body);
      const serializedState = createBody.serializedState;

      // Restore same state
      const restoreResponse = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        headers: sessionHeaders(createBody.sessionToken),
        payload: { serializedState },
      });

      expect(restoreResponse.statusCode).toBe(200);
      const restoreBody = JSON.parse(restoreResponse.body);
      expect(restoreBody.gameId).toBe(createBody.gameId);
      expect(restoreBody.serializedState).toBe(serializedState);
    });

    it('returns canonical serialized state by trimming oversized event history while preserving floor caches', async () => {
      const state = createTestGameStateInCombat();
      const storedFloor = createStoredFloorSnapshot(state);
      const longEventHistory: GameState['world']['eventHistory'] = Array.from(
        { length: 512 },
        (_, index) => ({
          type: 'ATTACK_PERFORMED',
          timestamp: index,
          turnNumber: index + 1,
          attackerId: entityId('player-1'),
          defenderId: entityId('enemy-1'),
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 1,
          damageType: 'physical',
          hit: true,
          critical: false,
          position: state.player.position,
        }),
      );
      const stateWithHistory: GameState = {
        ...state,
        world: {
          ...state.world,
          eventHistory: longEventHistory,
        },
        persistedFloorCache: new Map([[1, storedFloor]]),
      };
      const submittedSerializedState = serializeState(stateWithHistory);

      const response = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        payload: { serializedState: submittedSerializedState },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.serializedState).not.toBe(submittedSerializedState);

      const restoredState = deserializeState(body.serializedState);
      expect(restoredState.world.eventHistory.length).toBeLessThan(longEventHistory.length);
      expect(restoredState.world.eventHistory.at(-1)?.turnNumber).toBe(
        longEventHistory.at(-1)?.turnNumber,
      );
      expect(restoredState.persistedFloorCache?.get(1)?.lastSimulatedTurn).toBe(
        storedFloor.lastSimulatedTurn,
      );
      expect(restoredState.persistedFloorCache?.get(1)?.originalEnemyCount).toBe(
        storedFloor.originalEnemyCount,
      );
    });

    it('returns 409 when the submitted save conflicts with an existing server copy', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'Player1' },
      });
      const createBody = JSON.parse(createResponse.body);
      const storedState = deserializeState(createBody.serializedState);
      const conflictingState: GameState = {
        ...storedState,
        player: {
          ...storedState.player,
          gold: storedState.player.gold + 25,
        },
      };

      const restoreResponse = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        headers: sessionHeaders(createBody.sessionToken),
        payload: { serializedState: serializeState(conflictingState) },
      });

      expect(restoreResponse.statusCode).toBe(409);
      const restoreBody = JSON.parse(restoreResponse.body);
      expect(restoreBody.error).toBe('Restore conflict');
      expect(restoreBody.code).toBe('RESTORE_STATE_CONFLICT');
      expect(restoreBody.gameId).toBe(storedState.gameId);
    });

    it('returns 500 when warm restore fails unexpectedly without blaming the client save', async () => {
      const repo = createRepoStub({
        loadGame: vi.fn(() => Promise.reject(new Error('server storage unavailable'))),
      });
      const testApp = await buildApp({ repo });
      const state = createTestGameStateInCombat();

      const response = await testApp.inject({
        method: 'POST',
        url: '/api/games/restore',
        payload: { serializedState: serializeState(state) },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to restore existing game state');
      expect(body.code).toBe('RESTORE_WARM_LOAD_FAILED');
      await testApp.close();
    });

    it('returns 500 when cold restore creation fails unexpectedly', async () => {
      const repo = createRepoStub({
        createGame: vi.fn(() => Promise.reject(new Error('disk full'))),
      });
      const testApp = await buildApp({ repo });
      const state = createTestGameStateInCombat();

      const response = await testApp.inject({
        method: 'POST',
        url: '/api/games/restore',
        payload: { serializedState: serializeState(state) },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to restore game state');
      expect(body.code).toBe('RESTORE_CREATE_FAILED');
      await testApp.close();
    });
  });

  describe('State Consistency', () => {
    let gameId: EntityId;
    let sessionToken: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      gameId = createBody.gameId as EntityId;
      sessionToken = createBody.sessionToken;
    });

    it('persists state on subsequent GET requests after command submission', async () => {
      // Submit command
      const cmd1 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: { type: 'WAIT' },
      });
      expect(cmd1.statusCode).toBe(200);

      // Get state
      const view1 = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
        headers: sessionHeaders(sessionToken),
      });
      expect(view1.statusCode).toBe(200);
      const body1 = JSON.parse(view1.body);
      const turnNumber1 = body1.player?.turnNumber;

      // Get again
      const view2 = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
        headers: sessionHeaders(sessionToken),
      });
      expect(view2.statusCode).toBe(200);
      const body2 = JSON.parse(view2.body);
      const turnNumber2 = body2.player?.turnNumber;

      // Turn number should be consistent
      if (turnNumber1 !== undefined && turnNumber2 !== undefined) {
        expect(turnNumber1).toBe(turnNumber2);
      }
    });

    it('handles multiple commands in sequence without losing data', async () => {
      // Submit first command
      const cmd1 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: { type: 'WAIT' },
      });
      expect(cmd1.statusCode).toBe(200);

      // Submit second command
      const cmd2 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: { type: 'WAIT' },
      });
      expect(cmd2.statusCode).toBe(200);

      // Verify game still exists and is valid
      const view = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
        headers: sessionHeaders(sessionToken),
      });
      expect(view.statusCode).toBe(200);
      const body = JSON.parse(view.body);
      expect(body.player).toBeDefined();
    });

    it('maintains event history across multiple commands', async () => {
      // Submit command 1
      const cmd1 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: { type: 'WAIT' },
      });
      expect(cmd1.statusCode).toBe(200);

      // Submit command 2
      const cmd2 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: { type: 'WAIT' },
      });
      expect(cmd2.statusCode).toBe(200);

      // Check view for combatLog
      const view = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
        headers: sessionHeaders(sessionToken),
      });
      expect(view.statusCode).toBe(200);
      const body = JSON.parse(view.body);
      expect(body.combatLog).toBeDefined();
      expect(Array.isArray(body.combatLog)).toBe(true);
    });
  });

  describe('Response Headers and Content-Type', () => {
    let gameId: EntityId;
    let sessionToken: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      gameId = createBody.gameId as EntityId;
      sessionToken = createBody.sessionToken;
    });

    it('returns application/json content-type for GET /api/games/:id/view', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
        headers: sessionHeaders(sessionToken),
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('returns proper status codes for error responses', async () => {
      // Test 404
      const response404 = await app.inject({
        method: 'GET',
        url: '/api/games/nonexistent/view',
      });
      expect(response404.statusCode).toBe(404);

      // Test 400 - invalid command
      const response400 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: { type: 'INVALID' },
      });
      expect(response400.statusCode).toBe(400);
    });
  });

  describe('Edge Cases', () => {
    it('handles very large command payloads without crashing', async () => {
      // Create game
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      const gameId = createBody.gameId as EntityId;
      const sessionToken = createBody.sessionToken;

      // Send command with large payload (should be rejected or handled)
      const largePayload = {
        type: 'WAIT',
        // Add a very large string
        data: 'x'.repeat(10000),
      };

      const response = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: largePayload,
      });

      // Should either reject (400) or accept gracefully
      expect([400, 200]).toContain(response.statusCode);
    });

    it('handles missing required command fields', async () => {
      // Create game
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      const gameId = createBody.gameId as EntityId;
      const sessionToken = createBody.sessionToken;

      // Send command without type field
      const response = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('handles concurrent sequential commands without data loss', async () => {
      // Create game
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      const gameId = createBody.gameId as EntityId;
      const sessionToken = createBody.sessionToken;

      // Send multiple commands sequentially
      const cmd1 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: { type: 'WAIT' },
      });
      expect(cmd1.statusCode).toBe(200);

      const cmd2 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        headers: sessionHeaders(sessionToken),
        payload: { type: 'WAIT' },
      });
      expect(cmd2.statusCode).toBe(200);

      // Verify game is still valid
      const view = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
        headers: sessionHeaders(sessionToken),
      });
      expect(view.statusCode).toBe(200);
    });
  });
});
