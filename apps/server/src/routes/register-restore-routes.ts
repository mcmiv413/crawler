import type { FastifyInstance } from 'fastify';
import type { EntityId, IGameRepository } from '@dungeon/contracts';

import { handleRouteError } from '../errors.js';
import {
  buildColdRestoreResult,
  buildWarmRestoreResult,
  getRestoreSerializedState,
  loadExistingRestoreState,
  parseRestoreState,
} from '../services/restore-game-service.js';

const RESTORE_BODY_LIMIT_BYTES = 5 * 1024 * 1024;

export interface RegisterRestoreRoutesArgs {
  repo: IGameRepository;
}

export function registerRestoreRoutes(
  app: FastifyInstance,
  args: RegisterRestoreRoutesArgs,
): void {
  app.post('/api/games/restore', { bodyLimit: RESTORE_BODY_LIMIT_BYTES }, async (request, reply) => {
    const serializedState = getRestoreSerializedState(request.body);
    if (serializedState === null) {
      return reply.code(400).send({
        error: 'Missing serializedState',
        code: 'MISSING_SERIALIZED_STATE',
      });
    }

    let parsedRestoreState;
    try {
      parsedRestoreState = parseRestoreState(serializedState);
    } catch (error) {
      if (!handleRouteError(error, reply)) {
        throw error;
      }
      return;
    }

    if (!parsedRestoreState.state.gameId) {
      return reply.code(400).send({
        error: 'Invalid game state',
        code: 'INVALID_GAME_STATE',
      });
    }

    const providedToken = request.headers['x-dungeon-session'] as string | undefined;
    const loadResult = await loadExistingRestoreState(
      args.repo,
      parsedRestoreState.state.gameId as EntityId,
    );
    if (!loadResult.ok) {
      return reply.code(loadResult.response.statusCode).send(loadResult.response.body);
    }

    if (loadResult.state) {
      const restoreResult = await buildWarmRestoreResult({
        repo: args.repo,
        existingState: loadResult.state,
        providedToken,
        canonicalSerializedState: parsedRestoreState.canonicalSerializedState,
      });
      return reply.code(restoreResult.statusCode).send(restoreResult.body);
    }

    const restoreResult = await buildColdRestoreResult({
      repo: args.repo,
      state: parsedRestoreState.state,
      providedToken,
      canonicalSerializedState: parsedRestoreState.canonicalSerializedState,
    });
    return reply.code(restoreResult.statusCode).send(restoreResult.body);
  });
}
