import type { GameView } from '@dungeon/presenter';
import {
  fetchGameView,
  GameNotFoundError,
  restoreGame,
  sendCommand as sendCommandRequest,
} from '../api/client.js';
import type { CommandResponse } from '../api/client.js';
import { saveSession, loadSession } from './session-persistence.js';

export const FATAL_RESTORE_CODES = new Set([
  'INCOMPATIBLE_SAVE_FILE',
  'INVALID_GAME_STATE',
  'INVALID_SAVE_FILE',
  'MISSING_SERIALIZED_STATE',
]);

export const FATAL_RESTORE_MESSAGES = new Set([
  'Incompatible save file',
  'Invalid game state',
  'Invalid save file',
  'Missing serializedState',
]);

export function shouldClearSavedSession(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const apiError = error as Error & { readonly code?: string; readonly status?: number };

  // 403 SESSION_FORBIDDEN is fatal — clear the saved session
  if (apiError.status === 403 && apiError.code === 'SESSION_FORBIDDEN') {
    return true;
  }

  // Legacy 400 errors
  if (apiError.status !== 400) {
    return false;
  }

  return FATAL_RESTORE_CODES.has(apiError.code ?? '') || FATAL_RESTORE_MESSAGES.has(apiError.message);
}

export async function sendCommandWithColdRestore(
  gameId: string,
  command: unknown,
  sessionToken: string | null,
): Promise<{ result: CommandResponse; sessionToken: string | undefined }> {
  const currentSessionToken = sessionToken ?? undefined;

  try {
    const result = await sendCommandRequest(gameId, command, currentSessionToken);
    return { result, sessionToken: currentSessionToken };
  } catch (err) {
    if (!(err instanceof GameNotFoundError)) {
      throw err;
    }
  }

  const saved = loadSession();
  if (!saved) {
    throw new Error('Game session expired. Please start a new game.');
  }

  const restored = await restoreGame(saved.serializedState, saved.sessionToken);
  const result = await sendCommandRequest(gameId, command, restored.sessionToken);
  return { result, sessionToken: restored.sessionToken };
}

export async function restoreSessionWarmOrCold(
  saved: { readonly gameId: string; readonly serializedState: string; readonly sessionToken?: string },
): Promise<{
  gameId: string;
  view: GameView;
  sessionToken: string | undefined;
}> {
  // Try fetching view directly (server may still have it warm)
  try {
    const view = await fetchGameView(saved.gameId, saved.sessionToken);
    return {
      gameId: saved.gameId,
      view,
      sessionToken: saved.sessionToken ?? undefined,
    };
  } catch {
    // Server lost it (cold start) — restore from client state
  }

  const result = await restoreGame(saved.serializedState, saved.sessionToken);
  saveSession(result.gameId, result.serializedState, result.sessionToken);
  return {
    gameId: result.gameId,
    view: result.view,
    sessionToken: result.sessionToken,
  };
}
