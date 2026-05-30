import { randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { GameEngine } from '@dungeon/core';
import type { AiService } from '@dungeon/core/ai/ai-service.js';
import {
  CreateGameSchema,
  GameCommandSchema,
  type EntityId,
  type GameCommand,
  type GameState,
  type IGameRepository,
  type RunMetrics,
} from '@dungeon/contracts';
import { buildGameView } from '@dungeon/presenter';

import { handleRouteError } from '../errors.js';
import { processGameCommand } from '../game-command/process-command.js';
import {
  buildCreateGameResponse,
  buildDetailedGameViewResponse,
} from '../services/game-response-service.js';
import {
  checkSessionToken,
  generateSessionToken,
} from '../services/session-token-service.js';

export interface RegisterGameRoutesArgs {
  ai: AiService;
  engine: GameEngine;
  repo: IGameRepository;
}

interface RouteRegistrationContext extends RegisterGameRoutesArgs {
  readonly app: FastifyInstance;
}

type GameRequest = { Params: { id: string } };
type DialogueRequest = { Params: { id: string; npcId: string } };
type EventsRequest = { Params: { id: string }; Querystring: { limit?: string } };
type RunMetricsRequest = { Querystring: { gameId?: string; limit?: string } };

export function registerGameRoutes(
  app: FastifyInstance,
  args: RegisterGameRoutesArgs,
): void {
  const context: RouteRegistrationContext = { app, ...args };

  registerCreateGameRoute(context);
  registerLoadGameRoute(context);
  registerCommandRoute(context);
  registerNpcDialogueRoute(context);
  registerEventsRoute(context);
  registerDetailedViewRoute(context);
  registerRunMetricsRoute(context);
}

function registerCreateGameRoute({
  app,
  engine,
  repo,
}: RouteRegistrationContext): void {
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

    return reply.code(201).send(buildCreateGameResponse(state, sessionToken));
  });
}

function registerLoadGameRoute({
  app,
  repo,
}: RouteRegistrationContext): void {
  app.get<GameRequest>('/api/games/:id', async (request, reply) =>
    withHandledRouteError(reply, async () => {
      const state = await loadAuthorizedGameState({
        repo,
        gameId: request.params.id,
        providedToken: getProvidedSessionToken(request),
        reply,
      });
      return state === null ? undefined : buildGameView(state);
    }),
  );
}

function registerCommandRoute({
  app,
  ai,
  engine,
  repo,
}: RouteRegistrationContext): void {
  app.post<GameRequest>('/api/games/:id/commands', async (request, reply) =>
    withHandledRouteError(reply, async () => {
      const state = await loadAuthorizedGameState({
        repo,
        gameId: request.params.id,
        providedToken: getProvidedSessionToken(request),
        reply,
      });
      if (state === null) {
        return undefined;
      }

      const parsed = GameCommandSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid command', details: parsed.error.issues });
      }

      const command: GameCommand = parsed.data;
      return processGameCommand({
        ai,
        command,
        engine,
        gameId: request.params.id as EntityId,
        log: app.log,
        repo,
        state,
      });
    }),
  );
}

function registerNpcDialogueRoute({
  app,
  ai,
  repo,
}: RouteRegistrationContext): void {
  app.get<DialogueRequest>(
    '/api/games/:id/npc/:npcId/dialogue',
    async (request, reply) =>
      withHandledRouteError(reply, async () => {
        const state = await loadAuthorizedGameState({
          repo,
          gameId: request.params.id,
          providedToken: getProvidedSessionToken(request),
          reply,
        });
        if (state === null) {
          return undefined;
        }

        const npc = state.world.npcs.find(
          candidate => candidate.id === request.params.npcId,
        );
        if (npc === undefined) {
          return reply.code(404).send({ error: 'NPC not found' });
        }

        const recentEvents = await repo.getRecentEvents(
          request.params.id as EntityId,
          10,
        );
        const dialogue = await ai.generateDialogue({
          npc,
          townState: state.world.town,
          recentEvents,
          playerName: state.player.name,
          playerLevel: state.player.level,
        });

        return { npcId: npc.id, npcName: npc.name, dialogue };
      }),
  );
}

function registerEventsRoute({
  app,
  repo,
}: RouteRegistrationContext): void {
  app.get<EventsRequest>('/api/games/:id/events', async (request, reply) =>
    withHandledRouteError(reply, async () => {
      const state = await loadAuthorizedGameState({
        repo,
        gameId: request.params.id,
        providedToken: getProvidedSessionToken(request),
        reply,
      });
      if (state === null) {
        return undefined;
      }

      const limit = parseInt(request.query.limit ?? '50', 10);
      const events = await repo.getRecentEvents(request.params.id as EntityId, limit);
      return { events };
    }),
  );
}

function registerDetailedViewRoute({
  app,
  repo,
}: RouteRegistrationContext): void {
  app.get<GameRequest>('/api/games/:id/view', async (request, reply) =>
    withHandledRouteError(reply, async () => {
      const state = await loadAuthorizedGameState({
        repo,
        gameId: request.params.id,
        providedToken: getProvidedSessionToken(request),
        reply,
      });
      if (state === null) {
        return undefined;
      }

      const events = await repo.getRecentEvents(request.params.id as EntityId, 20);
      return buildDetailedGameViewResponse(state, events);
    }),
  );
}

function registerRunMetricsRoute({
  app,
  repo,
}: RouteRegistrationContext): void {
  app.get<RunMetricsRequest>('/api/runs/metrics', async (request, reply) => {
    if (request.query.gameId !== undefined) {
      const sessionCheck = await checkSessionToken(
        repo,
        request.query.gameId,
        getProvidedSessionToken(request),
      );
      if (!sessionCheck.ok) {
        return reply.code(sessionCheck.statusCode).send(sessionCheck.body);
      }
    }

    const allMetrics = getRunMetricsLog(repo);
    const filteredMetrics = request.query.gameId
      ? allMetrics.filter(metric => metric.gameId === request.query.gameId)
      : allMetrics;
    const limit = request.query.limit
      ? parseInt(request.query.limit, 10)
      : undefined;
    const limitedMetrics = limit
      ? filteredMetrics.slice(0, limit)
      : filteredMetrics;

    return {
      count: limitedMetrics.length,
      total: filteredMetrics.length,
      metrics: limitedMetrics,
      generatedAt: new Date().toISOString(),
    };
  });
}

function getRunMetricsLog(
  repo: IGameRepository,
): readonly (RunMetrics & { gameId?: string })[] {
  type RepoWithMetrics = {
    getRunMetricsLog?: () => readonly (RunMetrics & { gameId?: string })[];
  };

  return (repo as RepoWithMetrics).getRunMetricsLog?.() ?? [];
}

function generateServerSeed(): number {
  return randomInt(0, 2 ** 32);
}

function getProvidedSessionToken(request: {
  headers: Record<string, unknown>;
}): string | undefined {
  const token = request.headers['x-dungeon-session'];
  return typeof token === 'string' ? token : undefined;
}

async function withHandledRouteError<T>(
  reply: FastifyReply,
  action: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    if (!handleRouteError(error, reply)) {
      throw error;
    }
    return undefined;
  }
}

async function loadAuthorizedGameState(args: {
  repo: IGameRepository;
  gameId: string;
  providedToken: string | undefined;
  reply: FastifyReply;
}): Promise<GameState | null> {
  const authorized = await authorizeSessionOrReply({
    repo: args.repo,
    gameId: args.gameId,
    providedToken: args.providedToken,
    reply: args.reply,
  });
  if (!authorized) {
    return null;
  }

  return loadGameOrReplyNotFound(args.repo, args.gameId, args.reply);
}

async function authorizeSessionOrReply(args: {
  repo: IGameRepository;
  gameId: string;
  providedToken: string | undefined;
  reply: FastifyReply;
}): Promise<boolean> {
  const sessionCheck = await checkSessionToken(
    args.repo,
    args.gameId,
    args.providedToken,
  );
  if (!sessionCheck.ok) {
    await args.reply.code(sessionCheck.statusCode).send(sessionCheck.body);
    return false;
  }

  return true;
}

async function loadGameOrReplyNotFound(
  repo: IGameRepository,
  gameId: string,
  reply: FastifyReply,
): Promise<GameState | null> {
  const state = await repo.loadGame(gameId as EntityId);
  if (state === null) {
    await reply.code(404).send({ error: 'Game not found' });
    return null;
  }

  return state;
}
