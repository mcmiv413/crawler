import type { EntityId, IGameRepository } from '@dungeon/contracts';

export type SessionCheckResult =
  | { ok: true }
  | {
      ok: false;
      statusCode: 403;
      body:
        | { error: 'Session token required'; code: 'SESSION_FORBIDDEN' }
        | { error: 'Invalid session token'; code: 'SESSION_FORBIDDEN' };
    };

export async function generateSessionToken(): Promise<string> {
  const { randomBytes } = await import('node:crypto');
  return randomBytes(32).toString('hex');
}

export async function checkSessionToken(
  repo: IGameRepository,
  gameId: string,
  providedToken: string | undefined,
): Promise<SessionCheckResult> {
  const storedToken = await repo.getGameSessionToken(gameId as EntityId);
  if (storedToken === null) {
    return { ok: true };
  }

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
