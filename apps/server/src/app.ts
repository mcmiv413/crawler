import { randomInt } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { GameEngine, serializeState, deserializeState } from '@dungeon/core';
import { buildGameView, formatEvents, buildAnimationSequence } from '@dungeon/presenter';
import { GameCommandSchema, CreateGameSchema } from '@dungeon/contracts';
import type { AiService } from '@dungeon/core/ai/ai-service.js';
import type { GameCommand, EntityId, GameState, IGameRepository, RunMetrics } from '@dungeon/contracts';
import { CompositeAiService } from './ai/ai-service-composite.js';
import { processGameCommand } from './game-command/process-command.js';
import { InMemoryRepository } from './in-memory-repository.js';
import { registerDebugRoutes } from './routes/debug.js';
import { handleRouteError } from './errors.js';
import { MAX_EVENT_HISTORY } from '@dungeon/content';

const RESTORE_BODY_LIMIT_BYTES = 5 * 1024 * 1024;

interface BuildAppOptions {
  readonly ai?: AiService;
  readonly engine?: GameEngine;
  readonly repo?: IGameRepository;
}

function buildRestoreResponse(
  state: GameState,
  sessionToken: string,
  serializedState: string = getCanonicalSerializedState(state),
): { gameId: string; serializedState: string; view: ReturnType<typeof buildGameView>; sessionToken: string } {
  return {
    gameId: state.gameId,
    view: buildGameView(state),
    serializedState,
    sessionToken,
  };
}

function buildRestoreConflictResponse(gameId: string): {
  code: string;
  error: string;
  gameId: string;
  message: string;
} {
  return {
    error: 'Restore conflict',
    code: 'RESTORE_STATE_CONFLICT',
    message: 'Submitted save conflicts with existing server state for this game.',
    gameId,
  };
}

function generateServerSeed(): number {
  return randomInt(0, 2 ** 32);
}

function getCanonicalSerializedState(state: GameState): string {
  return serializeState(trimStateEventHistory(deserializeState(serializeState(state))));
}

function trimStateEventHistory(state: GameState): GameState {
  if (state.world.eventHistory.length <= MAX_EVENT_HISTORY) {
    return state;
  }

  return {
    ...state,
    world: {
      ...state.world,
      eventHistory: state.world.eventHistory.slice(-MAX_EVENT_HISTORY),
    },
  };
}

function getRestoreSerializedState(body: unknown): string | null {
  const restoreBody = body as { serializedState?: string };
  if (!restoreBody.serializedState || typeof restoreBody.serializedState !== 'string') {
    return null;
  }

  return restoreBody.serializedState;
}

async function generateSessionToken(): Promise<string> {
  const { randomBytes } = await import('node:crypto');
  return randomBytes(32).toString('hex');
}

type SessionCheckResult = 
  | { ok: true }
  | { ok: false; statusCode: number; body: Record<string, unknown> };

async function checkSessionToken(
  repo: IGameRepository,
  gameId: string,
  providedToken: string | undefined,
): Promise<SessionCheckResult> {
  const storedToken = await repo.getGameSessionToken(gameId as EntityId);
  
  // No stored token (legacy game)
  if (storedToken === null) {
    return { ok: true };
  }
  
  // Token required but not provided
  if (!providedToken) {
    return {
      ok: false,
      statusCode: 403,
      body: {
        error: 'Session token required',
        code: 'SESSION_FORBIDDEN',
      },
    };
  }
  
  // Token mismatch
  if (providedToken !== storedToken) {
    return {
      ok: false,
      statusCode: 403,
      body: {
        error: 'Invalid session token',
        code: 'SESSION_FORBIDDEN',
      },
    };
  }
  
  return { ok: true };
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const engine = options.engine ?? new GameEngine();
  const dbPath = process.env.DUNGEON_DB_PATH;
  const repo = options.repo ?? await (async () => {
    if (dbPath) {
      const { SqliteRepository } = await import('./sqlite-repository.js');
      return new SqliteRepository(dbPath);
    }

    return new InMemoryRepository();
  })();
  const ai = options.ai ?? new CompositeAiService();

  const lmHost = process.env['LM_HOST'];
  const lmPort = process.env['LM_PORT'] ?? '1234';
  app.log.info(`Repository: ${dbPath ? `SQLite (${dbPath})` : 'in-memory (non-durable)'}`);
  app.log.info(`AI: ${lmHost ? `LM Studio at ${lmHost}:${lmPort} (with fallback)` : 'fallback-only (LM_HOST not set)'}`);

  // POST /api/games — create a new game
  app.post('/api/games', async (request, reply) => {
    const body = CreateGameSchema.safeParse(request.body);
    const requestedSeed = body.success ? body.data.seed : undefined;
    const playerName = body.success ? body.data.playerName : undefined;
    const seed = requestedSeed ?? generateServerSeed();

    let state = engine.createNewGame(seed);
    if (playerName) {
      state = { ...state, player: { ...state.player, name: playerName } };
    }

    await repo.createGame(state);
    const sessionToken = await generateSessionToken();
    await repo.setGameSessionToken(state.gameId as EntityId, sessionToken);

    const view = buildGameView(state);
    const serializedState = getCanonicalSerializedState(state);

    return reply.code(201).send({
      gameId: state.gameId,
      view,
      serializedState,
      sessionToken,
    });
  });

  // GET /api/games/:id — get current game view
  app.get<{ Params: { id: string } }>('/api/games/:id', async (request, reply) => {
    try {
      const check = await checkSessionToken(repo, request.params.id, request.headers['x-dungeon-session'] as string | undefined);
      if (!check.ok) {
        return reply.code(check.statusCode).send(check.body);
      }

      const state = await repo.loadGame(request.params.id as EntityId);
      if (!state) return reply.code(404).send({ error: 'Game not found' });

      const view = buildGameView(state);
      return view;
    } catch (error) {
      if (!handleRouteError(error, reply)) {
        throw error;
      }
    }
  });

  // POST /api/games/:id/commands — submit a game command
  app.post<{ Params: { id: string } }>('/api/games/:id/commands', async (request, reply) => {
    try {
      const check = await checkSessionToken(repo, request.params.id, request.headers['x-dungeon-session'] as string | undefined);
      if (!check.ok) {
        return reply.code(check.statusCode).send(check.body);
      }
    } catch (error) {
      if (!handleRouteError(error, reply)) {
        throw error;
      }
      return;
    }

    let state: GameState | null;
    try {
      state = await repo.loadGame(request.params.id as EntityId);
    } catch (error) {
      if (!handleRouteError(error, reply)) {
        throw error;
      }
      return;
    }

    if (!state) return reply.code(404).send({ error: 'Game not found' });

    const parsed = GameCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid command', details: parsed.error.issues });
    }

    const command = parsed.data as GameCommand;
    return processGameCommand({
      ai,
      command,
      engine,
      gameId: request.params.id as EntityId,
      log: app.log,
      repo,
      state,
    });
  });

  // GET /api/games/:id/npc/:npcId/dialogue — get NPC dialogue
  app.get<{ Params: { id: string; npcId: string } }>(
    '/api/games/:id/npc/:npcId/dialogue',
    async (request, reply) => {
      try {
        const check = await checkSessionToken(repo, request.params.id, request.headers['x-dungeon-session'] as string | undefined);
        if (!check.ok) {
          return reply.code(check.statusCode).send(check.body);
        }
      } catch (error) {
        if (!handleRouteError(error, reply)) {
          throw error;
        }
        return;
      }

      let state: GameState | null;
      try {
        state = await repo.loadGame(request.params.id as EntityId);
      } catch (error) {
        if (!handleRouteError(error, reply)) {
          throw error;
        }
        return;
      }

      if (!state) return reply.code(404).send({ error: 'Game not found' });

      const npc = state.world.npcs.find(n => n.id === request.params.npcId);
      if (!npc) return reply.code(404).send({ error: 'NPC not found' });

      const recentEvents = await repo.getRecentEvents(request.params.id as EntityId, 10);

      const dialogue = await ai.generateDialogue({
        npc,
        townState: state.world.town,
        recentEvents,
        playerName: state.player.name,
        playerLevel: state.player.level,
      });

      return { npcId: npc.id, npcName: npc.name, dialogue };
    },
  );

  // GET /api/games/:id/events — get recent events
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/games/:id/events',
    async (request, reply) => {
      try {
        const check = await checkSessionToken(repo, request.params.id, request.headers['x-dungeon-session'] as string | undefined);
        if (!check.ok) {
          return reply.code(check.statusCode).send(check.body);
        }

        const state = await repo.loadGame(request.params.id as EntityId);
        if (!state) return reply.code(404).send({ error: 'Game not found' });

        const limit = parseInt(request.query.limit ?? '50', 10);
        const events = await repo.getRecentEvents(request.params.id as EntityId, limit);
        return { events };
      } catch (error) {
        if (!handleRouteError(error, reply)) {
          throw error;
        }
      }
    },
  );

  // POST /api/games/restore — restore a game from client-side serialized state
  app.post('/api/games/restore', { bodyLimit: RESTORE_BODY_LIMIT_BYTES }, async (request, reply) => {
    const serializedState = getRestoreSerializedState(request.body);
    if (serializedState === null) {
      return reply.code(400).send({
        error: 'Missing serializedState',
        code: 'MISSING_SERIALIZED_STATE',
      });
    }

    let state: GameState;
    let canonicalSerializedState: string;
    try {
      state = trimStateEventHistory(deserializeState(serializedState));
      canonicalSerializedState = serializeState(state);
    } catch (error) {
      if (!handleRouteError(error, reply)) {
        throw error;
      }
      return;
    }

    if (!state.gameId) {
      return reply.code(400).send({
        error: 'Invalid game state',
        code: 'INVALID_GAME_STATE',
      });
    }

    const providedToken = request.headers['x-dungeon-session'] as string | undefined;

    let existing: GameState | null;
    try {
      existing = await repo.loadGame(state.gameId as EntityId);
    } catch {
      return reply.code(500).send({
        error: 'Failed to restore existing game state',
        code: 'RESTORE_WARM_LOAD_FAILED',
      });
    }

    if (existing) {
      const existingToken = await repo.getGameSessionToken(state.gameId as EntityId);
      
      // Existing game with token: require matching token
      if (existingToken !== null) {
        if (!providedToken || providedToken !== existingToken) {
          return reply.code(403).send({
            error: 'Invalid session token',
            code: 'SESSION_FORBIDDEN',
          });
        }
      }
      
      // Check state match
      const existingSerializedState = getCanonicalSerializedState(existing);
      if (existingSerializedState !== canonicalSerializedState) {
        return reply.code(409).send(buildRestoreConflictResponse(state.gameId));
      }

      if (existingToken === null) {
        const sessionToken = providedToken ?? await generateSessionToken();
        await repo.setGameSessionToken(state.gameId as EntityId, sessionToken);
        return buildRestoreResponse(existing, sessionToken, existingSerializedState);
      }

      return buildRestoreResponse(existing, existingToken, existingSerializedState);
    }

    try {
      await repo.createGame(state);
      const sessionToken = providedToken ?? await generateSessionToken();
      await repo.setGameSessionToken(state.gameId as EntityId, sessionToken);
      return buildRestoreResponse(state, sessionToken, canonicalSerializedState);
    } catch {
      return reply.code(500).send({
        error: 'Failed to restore game state',
        code: 'RESTORE_CREATE_FAILED',
      });
    }
  });

  // Debug routes (dev only)
  registerDebugRoutes(app, repo);

  // GET /api/games/:id/view — get game view model
  app.get<{ Params: { id: string } }>('/api/games/:id/view', async (request, reply) => {
    try {
      const check = await checkSessionToken(repo, request.params.id, request.headers['x-dungeon-session'] as string | undefined);
      if (!check.ok) {
        return reply.code(check.statusCode).send(check.body);
      }

      const state = await repo.loadGame(request.params.id as EntityId);
      if (!state) return reply.code(404).send({ error: 'Game not found' });

      const view = buildGameView(state);
      const events = await repo.getRecentEvents(request.params.id as EntityId, 20);
      const combatLog = formatEvents(events);
      const animatedEvents = buildAnimationSequence(events, state);

      return { ...view, combatLog, animatedEvents };
    } catch (error) {
      if (!handleRouteError(error, reply)) {
        throw error;
      }
      return;
    }
  });

  // GET /api/runs/metrics — get aggregated session metrics
  app.get<{ Querystring: { gameId?: string; limit?: string } }>(
    '/api/runs/metrics',
    async (request, reply) => {
      if (request.query.gameId) {
        const check = await checkSessionToken(repo, request.query.gameId, request.headers['x-dungeon-session'] as string | undefined);
        if (!check.ok) {
          return reply.code(check.statusCode).send(check.body);
        }
      }

      // Query the database for run metrics
      type RepoWithMetrics = { getRunMetricsLog?: () => readonly (RunMetrics & { gameId?: string })[] };
      const allMetrics = (repo as RepoWithMetrics).getRunMetricsLog?.() ?? [];

      // Filter by gameId if provided
      const filteredMetrics = request.query.gameId
        ? allMetrics.filter((m) => m.gameId === request.query.gameId)
        : allMetrics;

      // Apply limit if specified
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : undefined;
      const limited = limit ? filteredMetrics.slice(0, limit) : filteredMetrics;

      return {
        count: limited.length,
        total: filteredMetrics.length,
        metrics: limited,
        generatedAt: new Date().toISOString(),
      };
    },
  );

  return app;
}
//HUMANNOTE: Major Issues:

//  1. Inconsistent Error Handling: The code has duplicated error handling logic across multiple routes (lines 114-128, 134-150, 176-192, 217-238, 318-342). This violates DRY principles and makes maintenance
//  harder.
//  2. Potential Race Condition in Restore Logic: In the restore endpoint (lines 292-296), there's a potential race condition where the check for existing state and the creation of new state happen in separate
//  operations.
//  3. Inefficient State Serialization: The getCanonicalSerializedState function (lines 49-51) does unnecessary double serialization/deserialization which could impact performance.
//  4. Missing Input Validation: The /api/games/:id/view endpoint (lines 317-343) doesn't validate that the gameId parameter is properly formatted.
//  5. Poor Error Response Consistency: Error responses are inconsistent in structure and status codes across different routes.

//  Suggestions for Improvement:

//  1. Extract Common Error Handling: Create reusable error handling functions for the duplicated logic.
//  2. Add Input Validation: Validate route parameters more thoroughly.
//  3. Improve Restore Logic: Use atomic operations or transactions to prevent race conditions.
//  4. Optimize Serialization: Remove unnecessary double serialization in getCanonicalSerializedState.
//  5. Standardize Error Responses: Make error response structures consistent across all endpoints.
