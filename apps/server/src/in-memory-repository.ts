import type { IGameRepository, GameState, EntityId, DomainEvent, RunMetrics } from '@dungeon/contracts';

export class InMemoryRepository implements IGameRepository {
  private games = new Map<string, GameState>();
  private events = new Map<string, DomainEvent[]>();
  private runMetricsLog: RunMetrics[] = [];

  async createGame(state: GameState): Promise<void> {
    this.games.set(state.gameId, state);
    this.events.set(state.gameId, []);
  }

  async loadGame(gameId: EntityId): Promise<GameState | null> {
    return this.games.get(gameId) ?? null;
  }

  async saveGame(gameId: EntityId, state: GameState): Promise<void> {
    this.games.set(gameId, state);
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
