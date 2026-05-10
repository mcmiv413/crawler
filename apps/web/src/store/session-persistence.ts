const STORAGE_KEY = 'dungeon-session';

interface PersistedSession {
  readonly gameId: string;
  readonly serializedState: string;
  readonly sessionToken?: string;
}

export function saveSession(gameId: string, serializedState: string, sessionToken?: string): void {
  try {
    const data: PersistedSession = { gameId, serializedState, sessionToken };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PersistedSession>;
    // Support legacy sessions without sessionToken
    if (typeof data.gameId === 'string' && typeof data.serializedState === 'string') {
      return {
        gameId: data.gameId,
        serializedState: data.serializedState,
        sessionToken: data.sessionToken,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
