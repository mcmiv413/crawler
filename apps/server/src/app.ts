import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { GameEngine } from '@dungeon/core';
import { buildGameView, formatEvents } from '@dungeon/presenter';
import { GameCommandSchema, CreateGameSchema } from '@dungeon/contracts';
import type { GameCommand, EntityId, GameState, RunMetrics } from '@dungeon/contracts';
import { EMPTY_RUN_METRICS } from '@dungeon/contracts';
import { InMemoryRepository } from './in-memory-repository.js';
import { CompositeAiService } from './ai/ai-service-composite.js';
import { applyRunConsequences, rollNemesisLoot, addItemToInventory, serializeState, deserializeState } from '@dungeon/core';
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

    return reply.code(201).send({
      gameId: state.gameId,
      view,
      serializedState: serializeState(state),
    });
  });

  // GET /api/games/:id — get current game view
  app.get<{ Params: { id: string } }>('/api/games/:id', async (request, reply) => {
    const state = await repo.loadGame(request.params.id as EntityId);
    if (!state) return reply.code(404).send({ error: 'Game not found' });

    const view = buildGameView(state);
    return view;
  });

  // POST /api/games/:id/commands — submit a game command
  app.post<{ Params: { id: string } }>('/api/games/:id/commands', async (request, reply) => {
    const state = await repo.loadGame(request.params.id as EntityId);
    if (!state) return reply.code(404).send({ error: 'Game not found' });

    const parsed = GameCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid command', details: parsed.error.issues });
    }

    const command = parsed.data as GameCommand;
    const result = engine.submitCommand(state, command);

    let finalState = result.state;

    // Patch any newly promoted nemesis with an AI-generated name
    const newNemesis = result.events.find(e => e.type === 'NEMESIS_PROMOTED');
    if (newNemesis && newNemesis.type === 'NEMESIS_PROMOTED') {
      const promoted = finalState.world.nemeses.find(n => n.id === newNemesis.nemesisId);
      if (promoted) {
        const aiName = await ai.generateNemesisName({
          enemyTemplateName: promoted.sourceTemplateId,
          tier: promoted.tier,
          floor: promoted.floorOfAscension,
          biome: promoted.biomeOfAscension,
        });
        finalState = {
          ...finalState,
          world: {
            ...finalState.world,
            nemeses: finalState.world.nemeses.map(n =>
              n.id === promoted.id
                ? { ...n, name: aiName.name, title: aiName.title }
                : n,
            ),
          },
        };
      }
    }

    // Generate unique loot for slain nemesis
    const slainEvent = result.events.find(e => e.type === 'NEMESIS_SLAIN');
    if (slainEvent && slainEvent.type === 'NEMESIS_SLAIN') {
      const slainNemesis = finalState.world.nemeses.find(n => n.id === slainEvent.nemesisId);
      if (slainNemesis) {
        try {
          const lootData = await ai.generateNemesisLoot({
            nemesisName: slainNemesis.name,
            nemesisTitle: slainNemesis.title,
            tier: slainNemesis.tier,
            floor: slainNemesis.floorOfAscension,
            traits: slainNemesis.traits,
            weaponType: slainNemesis.killedByWeaponType,
            rank: slainNemesis.rank,
          });

          // Create the unique item and add to inventory
          const lootTemplate = rollNemesisLoot(
            lootData,
            slainNemesis.rank,
            slainNemesis.tier,
            finalState.player.floor,
            slainNemesis.killedByWeaponType,
          );

          const lootResult = addItemToInventory(finalState, lootTemplate);
          finalState = lootResult.state;

          // Update the NEMESIS_SLAIN event with the loot item name by creating new array
          const updatedEvents = result.events.map(e =>
            e.type === 'NEMESIS_SLAIN'
              ? { ...e, lootItemName: lootData.name }
              : e,
          );
          // Update result events (create new object to avoid mutation)
          Object.defineProperty(result, 'events', {
            value: updatedEvents,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        } catch (error) {
          // If loot generation fails, continue without the unique item
          // Silently fail - nemesis loot generation is non-critical
        }
      }
    }

    // Record telemetry and generate run summary if run ended
    if (result.runEnded && finalState.run?.runMetrics) {
      const metrics = finalState.run.runMetrics;
      repo.recordRunMetrics(metrics, request.params.id as EntityId);

      // Archive overflow events before trim (only if history exceeds cap)
      const historyLength = finalState.world.eventHistory.length;
      if (historyLength > 100) {
        const overflow = finalState.world.eventHistory.slice(0, historyLength - 100);
        if (overflow.length > 0) {
          await repo.appendEvents(request.params.id as EntityId, overflow);
        }
      }

      // Apply world consequences (town axes, faction ticks, event chains)
      const consequenceResult = applyRunConsequences(finalState, metrics);
      finalState = consequenceResult.state;

      // Generate run summary
      const summary = await ai.generateRunSummary({
        runMetrics: metrics,
        recentEvents: result.events,
        playerName: finalState.player.name,
        floor: finalState.player.floor,
      });

      finalState = {
        ...finalState,
        world: {
          ...finalState.world,
          town: {
            ...finalState.world.town,
            lastRunSummary: summary,
          },
        },
      };

      // Generate rumors on return to town
      try {
        finalState = await generateRumors(finalState, ai);
      } catch {
        // rumors are non-critical; continue without them
      }
    }

    // Add events to state's event history so presenter can see them
    if (result.events.length > 0) {
      finalState = {
        ...finalState,
        world: {
          ...finalState.world,
          eventHistory: [...finalState.world.eventHistory, ...result.events],
        },
      };
    }

    // Atomically save state and events in a single transaction (prevents torn event logs).
    // commitTick enforces all-or-nothing semantics:
    // - If version mismatch (concurrent write), throws before any mutations
    // - If success, both state and events persist together
    // - No intermediate state where one is saved but the other is lost
    // Uses OCC (Optimistic Concurrency Control) to detect concurrent modifications
    const prevVersion = state.version; // Version before this command was processed
    await repo.commitTick(request.params.id as EntityId, prevVersion, finalState, result.events);
    const view = buildGameView(finalState);
    const combatLog = formatEvents(result.events);

    return {
      view: { ...view, combatLog },
      events: result.events,
      runEnded: result.runEnded,
      serializedState: serializeState(finalState),
    };
  });

  // GET /api/games/:id/npc/:npcId/dialogue — get NPC dialogue
  app.get<{ Params: { id: string; npcId: string } }>(
    '/api/games/:id/npc/:npcId/dialogue',
    async (request, reply) => {
      const state = await repo.loadGame(request.params.id as EntityId);
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
      const state = await repo.loadGame(request.params.id as EntityId);
      if (!state) return reply.code(404).send({ error: 'Game not found' });

      const limit = parseInt(request.query.limit ?? '50', 10);
      const events = await repo.getRecentEvents(request.params.id as EntityId, limit);
      return { events };
    },
  );

  // POST /api/games/restore — restore a game from client-side serialized state
  app.post('/api/games/restore', async (request, reply) => {
    const body = request.body as { serializedState?: string };
    if (!body.serializedState || typeof body.serializedState !== 'string') {
      return reply.code(400).send({ error: 'Missing serializedState' });
    }

    try {
      const state = deserializeState(body.serializedState);
      if (!state.gameId) {
        return reply.code(400).send({ error: 'Invalid game state' });
      }

      // Check if game already exists in repo (warm instance)
      const existing = await repo.loadGame(state.gameId as EntityId);
      if (existing) {
        // Server already has it — just return the view
        const view = buildGameView(existing);
        return { gameId: existing.gameId, view, serializedState: serializeState(existing) };
      }

      // Cold start: re-hydrate from client state
      await repo.createGame(state);
      const view = buildGameView(state);
      return { gameId: state.gameId, view, serializedState: body.serializedState };
    } catch {
      return reply.code(400).send({ error: 'Failed to deserialize game state' });
    }
  });

  // Debug routes (dev only)
  registerDebugRoutes(app, repo);

  // GET /api/games/:id/view — get game view model
  app.get<{ Params: { id: string } }>('/api/games/:id/view', async (request, reply) => {
    const state = await repo.loadGame(request.params.id as EntityId);
    if (!state) return reply.code(404).send({ error: 'Game not found' });

    const view = buildGameView(state);
    const events = await repo.getRecentEvents(request.params.id as EntityId, 20);
    const combatLog = formatEvents(events);

    return { ...view, combatLog };
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

async function generateRumors(state: GameState, ai: CompositeAiService): Promise<GameState> {
  const rumorCount = 3;
  const rumorArgs = {
    townState: state.world.town,
    deepestFloor: state.world.deepestFloor,
    totalRuns: state.world.totalRuns,
    recentEvents: state.world.eventHistory.slice(-10),
  };

  const rumors = await Promise.all(
    Array.from({ length: rumorCount }, () => ai.generateRumor(rumorArgs)),
  );

  return {
    ...state,
    world: {
      ...state.world,
      town: {
        ...state.world.town,
        rumors,
      },
    },
  };
}
