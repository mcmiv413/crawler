import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { GameEngine, serializeState, deserializeState } from '@dungeon/core';
import { buildGameView, formatEvents, buildAnimationSequence } from '@dungeon/presenter';
import { GameCommandSchema, CreateGameSchema, SchemaVersionMismatchError, SchemaParseError, getSchemaVersionErrorMessage } from '@dungeon/contracts';
import type { GameCommand, EntityId, GameState, RunMetrics } from '@dungeon/contracts';
import { CompositeAiService } from './ai/ai-service-composite.js';
import { processGameCommand } from './game-command/process-command.js';
import { InMemoryRepository } from './in-memory-repository.js';
import { registerDebugRoutes } from './routes/debug.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const engine = new GameEngine();
  const dbPath = process.env.DUNGEON_DB_PATH;
  let repo;
  if (dbPath) {
    const { SqliteRepository } = await import('./sqlite-repository.js');
    repo = new SqliteRepository(dbPath);
  } else {
    repo = new InMemoryRepository();
  }
  const ai = new CompositeAiService();

  const lmHost = process.env['LM_HOST'];
  const lmPort = process.env['LM_PORT'] ?? '1234';
  app.log.info(`Repository: ${dbPath ? `SQLite (${dbPath})` : 'in-memory (non-durable)'}`);
  app.log.info(`AI: ${lmHost ? `LM Studio at ${lmHost}:${lmPort} (with fallback)` : 'fallback-only (LM_HOST not set)'}`);

  // POST /api/games — create a new game
  app.post('/api/games', async (request, reply) => {
    const body = CreateGameSchema.safeParse(request.body);
    const seed = body.success ? body.data.seed : undefined;
    const playerName = body.success ? body.data.playerName : undefined;

    let state = engine.createNewGame(seed);
    if (playerName) {
      state = { ...state, player: { ...state.player, name: playerName } };
    }

    await repo.createGame(state);
    const view = buildGameView(state);
    const serializedState = serializeState(state);

    return reply.code(201).send({
      gameId: state.gameId,
      view,
      serializedState,
    });
  });

  // GET /api/games/:id — get current game view
  app.get<{ Params: { id: string } }>('/api/games/:id', async (request, reply) => {
    try {
      const state = await repo.loadGame(request.params.id as EntityId);
      if (!state) return reply.code(404).send({ error: 'Game not found' });

      const view = buildGameView(state);
      return view;
    } catch (error) {
      if (error instanceof SchemaVersionMismatchError) {
        return reply.code(400).send({
          error: 'Incompatible save file',
          message: getSchemaVersionErrorMessage(error.foundVersion),
        });
      }
      if (error instanceof SchemaParseError) {
        return reply.code(400).send({
          error: 'Invalid save file',
          message: error.message,
        });
      }
      throw error;
    }
  });

  // POST /api/games/:id/commands — submit a game command
  app.post<{ Params: { id: string } }>('/api/games/:id/commands', async (request, reply) => {
    let state: GameState | null;
    try {
      state = await repo.loadGame(request.params.id as EntityId);
    } catch (error) {
      if (error instanceof SchemaVersionMismatchError) {
        return reply.code(400).send({
          error: 'Incompatible save file',
          message: getSchemaVersionErrorMessage(error.foundVersion),
        });
      }
      if (error instanceof SchemaParseError) {
        return reply.code(400).send({
          error: 'Invalid save file',
          message: error.message,
        });
      }
      throw error;
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
      let state: GameState | null;
      try {
        state = await repo.loadGame(request.params.id as EntityId);
      } catch (error) {
        if (error instanceof SchemaVersionMismatchError) {
          return reply.code(400).send({
            error: 'Incompatible save file',
            message: getSchemaVersionErrorMessage(error.foundVersion),
          });
        }
        if (error instanceof SchemaParseError) {
          return reply.code(400).send({
            error: 'Invalid save file',
            message: error.message,
          });
        }
        throw error;
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
        const state = await repo.loadGame(request.params.id as EntityId);
        if (!state) return reply.code(404).send({ error: 'Game not found' });

        const limit = parseInt(request.query.limit ?? '50', 10);
        const events = await repo.getRecentEvents(request.params.id as EntityId, limit);
        return { events };
      } catch (error) {
        if (error instanceof SchemaVersionMismatchError) {
          return reply.code(400).send({
            error: 'Incompatible save file',
            message: getSchemaVersionErrorMessage(error.foundVersion),
          });
        }
        if (error instanceof SchemaParseError) {
          return reply.code(400).send({
            error: 'Invalid save file',
            message: error.message,
          });
        }
        throw error;
      }
    },
  );

  // POST /api/games/restore — restore a game from client-side serialized state
  app.post('/api/games/restore', async (request, reply) => {
    const body = request.body as {
      serializedState?: string;
    };
    if (!body.serializedState || typeof body.serializedState !== 'string') {
      return reply.code(400).send({ error: 'Missing serializedState' });
    }

    try {
      const state = deserializeState(body.serializedState);
      if (!state.gameId) {
        return reply.code(400).send({ error: 'Invalid game state' });
      }

      // Check if game already exists in repo (warm instance)
      try {
        const existing = await repo.loadGame(state.gameId as EntityId);
        if (existing) {
          // Server already has it — just return the view
          const view = buildGameView(existing);
          const existingSerializedState = serializeState(existing);
          return {
            gameId: existing.gameId,
            view,
            serializedState: existingSerializedState,
          };
        }
      } catch (loadError) {
        // If server has a corrupted version of this game, we can't load it
        if (loadError instanceof SchemaVersionMismatchError) {
          return reply.code(400).send({
            error: 'Incompatible save file on server',
            message: getSchemaVersionErrorMessage(loadError.foundVersion),
          });
        }
        if (loadError instanceof SchemaParseError) {
          return reply.code(400).send({
            error: 'Corrupted save file on server',
            message: loadError.message,
          });
        }
        throw loadError;
      }

      // Cold start: re-hydrate from client state
      await repo.createGame(state);
      const view = buildGameView(state);
      return {
        gameId: state.gameId,
        view,
        serializedState: body.serializedState,
      };
    } catch (error) {
      if (error instanceof SchemaVersionMismatchError) {
        return reply.code(400).send({
          error: 'Incompatible save file',
          message: getSchemaVersionErrorMessage(error.foundVersion),
        });
      }
      if (error instanceof SchemaParseError) {
        return reply.code(400).send({
          error: 'Invalid save file',
          message: error.message,
        });
      }
      return reply.code(400).send({ error: 'Failed to deserialize game state' });
    }
  });

  // Debug routes (dev only)
  registerDebugRoutes(app, repo);

  // GET /api/games/:id/view — get game view model
  app.get<{ Params: { id: string } }>('/api/games/:id/view', async (request, reply) => {
    try {
      const state = await repo.loadGame(request.params.id as EntityId);
      if (!state) return reply.code(404).send({ error: 'Game not found' });

      const view = buildGameView(state);
      const events = await repo.getRecentEvents(request.params.id as EntityId, 20);
      const combatLog = formatEvents(events);
      const animatedEvents = buildAnimationSequence(events, state);

      return { ...view, combatLog, animatedEvents };
    } catch (error) {
      if (error instanceof SchemaVersionMismatchError) {
        return reply.code(400).send({
          error: 'Incompatible save file',
          message: getSchemaVersionErrorMessage(error.foundVersion),
        });
      }
      if (error instanceof SchemaParseError) {
        return reply.code(400).send({
          error: 'Invalid save file',
          message: error.message,
        });
      }
      throw error;
    }
  });

  // GET /api/runs/metrics — get aggregated session metrics
  app.get<{ Querystring: { gameId?: string; limit?: string } }>(
    '/api/runs/metrics',
    async (request) => {
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

