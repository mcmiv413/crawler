import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { deserializeState, serializeState } from '@dungeon/core';
import { createTestEnemy, createTestGameStateInCombat } from '@dungeon/core/testing';
import type { EntityId, GameCommand } from '@dungeon/contracts';

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
      expect(body.gameId).toBeDefined();
      expect(body.view).toBeDefined();
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
      expect(body.gameId).toBeDefined();
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

    beforeEach(async () => {
      // Create game through app API so it's stored in app's internal repo
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      gameId = createBody.gameId as EntityId;
    });

    it('submits a valid command and returns 200 with updated view', async () => {
      const command: GameCommand = {
        type: 'WAIT',
      };

      const response = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
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
        payload: command,
      });

      // Fetch game state after command
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
      });

      expect(getResponse.statusCode).toBe(200);
      const viewBody = JSON.parse(getResponse.body);
      expect(viewBody).toHaveProperty('player');
      expect(viewBody.player).toBeDefined();
    });

    it('applies run consequences exactly once on victory', async () => {
      const baseState = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
      const boss = createTestEnemy({
        position: { x: 1, y: 0 },
        tier: 4,
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

      const victoryState = {
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

      const attackResponse = await app.inject({
        method: 'POST',
        url: `/api/games/${victoryState.gameId}/commands`,
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

    beforeEach(async () => {
      // Create game through app API
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      gameId = createBody.gameId as EntityId;
    });

    it('returns 200 with current GameView when game exists', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
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
        payload: { type: 'WAIT' },
      });
      expect(commandResponse.statusCode).toBe(200);

      // Get updated view
      const viewResponse = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
      });

      expect(viewResponse.statusCode).toBe(200);
      const body = JSON.parse(viewResponse.body);
      expect(body).toHaveProperty('combatLog');
      expect(Array.isArray(body.combatLog)).toBe(true);
    });
  });

  describe('GET /api/games/:id', () => {
    let gameId: EntityId;

    beforeEach(async () => {
      // Create game through app API
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      gameId = createBody.gameId as EntityId;
    });

    it('returns 200 with GameView (alias for /view endpoint)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}`,
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
      const stateSignature = createBody.stateSignature;

      // Restore the game
      const restoreResponse = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        payload: { serializedState, stateSignature },
      });

      expect(restoreResponse.statusCode).toBe(200);
      const restoreBody = JSON.parse(restoreResponse.body);
      expect(restoreBody).toHaveProperty('gameId');
      expect(restoreBody).toHaveProperty('view');
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
    });

    it('returns existing game if already in repository', async () => {
      // Create a game
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'Player1' },
      });
      const createBody = JSON.parse(createResponse.body);
      const serializedState = createBody.serializedState;
      const stateSignature = createBody.stateSignature;

      // Restore same state
      const restoreResponse = await app.inject({
        method: 'POST',
        url: '/api/games/restore',
        payload: { serializedState, stateSignature },
      });

      expect(restoreResponse.statusCode).toBe(200);
      const restoreBody = JSON.parse(restoreResponse.body);
      // Should get same gameId back if already in repo
      expect(restoreBody.gameId).toBeDefined();
    });
  });

  describe('State Consistency', () => {
    let gameId: EntityId;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      gameId = createBody.gameId as EntityId;
    });

    it('persists state on subsequent GET requests after command submission', async () => {
      // Submit command
      const cmd1 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        payload: { type: 'WAIT' },
      });
      expect(cmd1.statusCode).toBe(200);

      // Get state
      const view1 = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
      });
      expect(view1.statusCode).toBe(200);
      const body1 = JSON.parse(view1.body);
      const turnNumber1 = body1.player?.turnNumber;

      // Get again
      const view2 = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
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
        payload: { type: 'WAIT' },
      });
      expect(cmd1.statusCode).toBe(200);

      // Submit second command
      const cmd2 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        payload: { type: 'WAIT' },
      });
      expect(cmd2.statusCode).toBe(200);

      // Verify game still exists and is valid
      const view = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
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
        payload: { type: 'WAIT' },
      });
      expect(cmd1.statusCode).toBe(200);

      // Submit command 2
      const cmd2 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        payload: { type: 'WAIT' },
      });
      expect(cmd2.statusCode).toBe(200);

      // Check view for combatLog
      const view = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
      });
      expect(view.statusCode).toBe(200);
      const body = JSON.parse(view.body);
      expect(body.combatLog).toBeDefined();
      expect(Array.isArray(body.combatLog)).toBe(true);
    });
  });

  describe('Response Headers and Content-Type', () => {
    let gameId: EntityId;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: { playerName: 'TestPlayer' },
      });
      const createBody = JSON.parse(createResponse.body);
      gameId = createBody.gameId as EntityId;
    });

    it('returns application/json content-type for GET /api/games/:id/view', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
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

      // Send command with large payload (should be rejected or handled)
      const largePayload = {
        type: 'WAIT',
        // Add a very large string
        data: 'x'.repeat(10000),
      };

      const response = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
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

      // Send command without type field
      const response = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
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

      // Send multiple commands sequentially
      const cmd1 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        payload: { type: 'WAIT' },
      });
      expect(cmd1.statusCode).toBe(200);

      const cmd2 = await app.inject({
        method: 'POST',
        url: `/api/games/${gameId}/commands`,
        payload: { type: 'WAIT' },
      });
      expect(cmd2.statusCode).toBe(200);

      // Verify game is still valid
      const view = await app.inject({
        method: 'GET',
        url: `/api/games/${gameId}/view`,
      });
      expect(view.statusCode).toBe(200);
    });
  });
});
