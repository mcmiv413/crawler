const STORAGE_KEY = 'dungeon-session';

interface PersistedSession {
  readonly gameId: string;
  readonly serializedState: string;
}

export function saveSession(gameId: string, serializedState: string): void {
  try {
    const data: PersistedSession = { gameId, serializedState };
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
    if (typeof data.gameId === 'string' && typeof data.serializedState === 'string') {
      return data as PersistedSession;
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
