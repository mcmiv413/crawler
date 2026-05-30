import type { EntityId, GameState, IGameRepository } from '@dungeon/contracts';
import { deserializeState } from '@dungeon/core';

import { buildRestoreResponse, canonicalizeGameState } from './game-response-service.js';
import { generateSessionToken } from './session-token-service.js';

export interface RestoreRouteResult {
  statusCode: number;
  body: Record<string, unknown>;
}

export interface ParsedRestoreState {
  state: GameState;
  canonicalSerializedState: string;
}

export function getRestoreSerializedState(body: unknown): string | null {
  const restoreBody = body as { serializedState?: string };
  if (!restoreBody.serializedState || typeof restoreBody.serializedState !== 'string') {
    return null;
  }

  return restoreBody.serializedState;
}

export function parseRestoreState(serializedState: string): ParsedRestoreState {
  const parsedState = deserializeState(serializedState);
  const canonicalState = canonicalizeGameState(parsedState);

  return {
    state: canonicalState.state,
    canonicalSerializedState: canonicalState.serializedState,
  };
}

export async function loadExistingRestoreState(
  repo: IGameRepository,
  gameId: EntityId,
): Promise<
  { ok: true; state: GameState | null } | { ok: false; response: RestoreRouteResult }
> {
  try {
    return { ok: true, state: await repo.loadGame(gameId) };
  } catch {
    return {
      ok: false,
      response: {
        statusCode: 500,
        body: {
          error: 'Failed to restore existing game state',
          code: 'RESTORE_WARM_LOAD_FAILED',
        },
      },
    };
  }
}

export async function buildWarmRestoreResult(args: {
  repo: IGameRepository;
  existingState: GameState;
  providedToken: string | undefined;
  canonicalSerializedState: string;
}): Promise<RestoreRouteResult> {
  const { canonicalSerializedState, existingState, providedToken, repo } = args;
  const existingToken = await repo.getGameSessionToken(existingState.gameId as EntityId);

  if (existingToken !== null && (!providedToken || providedToken !== existingToken)) {
    return {
      statusCode: 403,
      body: {
        error: 'Invalid session token',
        code: 'SESSION_FORBIDDEN',
      },
    };
  }

  const existingSerializedState = canonicalizeGameState(existingState).serializedState;
  if (existingSerializedState !== canonicalSerializedState) {
    return {
      statusCode: 409,
      body: buildRestoreConflictResponse(existingState.gameId),
    };
  }

  if (existingToken === null) {
    const sessionToken = providedToken ?? (await generateSessionToken());
    await repo.setGameSessionToken(existingState.gameId as EntityId, sessionToken);
    return {
      statusCode: 200,
      body: buildRestoreResponse(existingState, sessionToken, existingSerializedState),
    };
  }

  return {
    statusCode: 200,
    body: buildRestoreResponse(existingState, existingToken, existingSerializedState),
  };
}

export async function buildColdRestoreResult(args: {
  repo: IGameRepository;
  state: GameState;
  providedToken: string | undefined;
  canonicalSerializedState: string;
}): Promise<RestoreRouteResult> {
  const { canonicalSerializedState, providedToken, repo, state } = args;

  try {
    await repo.createGame(state);
    const sessionToken = providedToken ?? (await generateSessionToken());
    await repo.setGameSessionToken(state.gameId as EntityId, sessionToken);
    return {
      statusCode: 200,
      body: buildRestoreResponse(state, sessionToken, canonicalSerializedState),
    };
  } catch {
    return {
      statusCode: 500,
      body: {
        error: 'Failed to restore game state',
        code: 'RESTORE_CREATE_FAILED',
      },
    };
  }
}

function buildRestoreConflictResponse(gameId: string) {
  return {
    error: 'Restore conflict',
    code: 'RESTORE_STATE_CONFLICT',
    message: 'Submitted save conflicts with existing server state for this game.',
    gameId,
  };
}
