import type { IGameRepository, GameState, EntityId, DomainEvent, RunMetrics } from '@dungeon/contracts';

export class InMemoryRepository implements IGameRepository {
  private games = new Map<string, GameState>();
  private events = new Map<string, DomainEvent[]>();
  private runMetricsLog: RunMetrics[] = [];
  // Track version numbers per game for OCC (Optimistic Concurrency Control)
  private versions = new Map<string, number>();

  async createGame(state: GameState): Promise<void> {
    this.games.set(state.gameId, state);
    this.events.set(state.gameId, []);
    this.versions.set(state.gameId, state.version);
  }

  async loadGame(gameId: EntityId): Promise<GameState | null> {
    return this.games.get(gameId) ?? null;
  }

  async saveGame(gameId: EntityId, state: GameState): Promise<void> {
    // Optimistic Concurrency Control: Check that version matches
    const currentVersion = this.versions.get(gameId);
    if (currentVersion !== state.version) {
      throw new Error(
        `Concurrent modification detected for game ${gameId}. ` +
          `Expected version ${currentVersion}, got ${state.version}. ` +
          `Please retry the command.`,
      );
    }

    // Increment version and save state
    const nextVersion = state.version + 1;
    const newState = { ...state, version: nextVersion };
    this.games.set(gameId, newState);
    this.versions.set(gameId, nextVersion);
  }

  async appendEvents(gameId: EntityId, events: readonly DomainEvent[]): Promise<void> {
    const existing = this.events.get(gameId) ?? [];
    this.events.set(gameId, [...existing, ...events]);
  }

  async getRecentEvents(gameId: EntityId, limit: number): Promise<readonly DomainEvent[]> {
    const all = this.events.get(gameId) ?? [];
    return all.slice(-limit);
  }

  recordRunMetrics(metrics: RunMetrics, _gameId?: string): void {
    this.runMetricsLog.push(metrics);
  }

  getRunMetricsLog(): readonly RunMetrics[] {
    return this.runMetricsLog;
  }
}
