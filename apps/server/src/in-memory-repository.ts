import type { IGameRepository, GameState, EntityId, DomainEvent, RunMetrics } from '@dungeon/contracts';
import { deserializeState, serializeState } from '@dungeon/core';

function cloneGameState(state: GameState): GameState {
  return deserializeState(serializeState(state));
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryRepository implements IGameRepository {
  private games = new Map<string, GameState>();
  private events = new Map<string, DomainEvent[]>();
  private runMetricsLog: RunMetrics[] = [];
  // Track version numbers per game for OCC (Optimistic Concurrency Control)
  private versions = new Map<string, number>();

  async createGame(state: GameState): Promise<void> {
    this.games.set(state.gameId, cloneGameState(state));
    this.events.set(state.gameId, []);
    this.versions.set(state.gameId, state.version);
  }

  async loadGame(gameId: EntityId): Promise<GameState | null> {
    const state = this.games.get(gameId);
    return state === undefined ? null : cloneGameState(state);
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
    const newState = cloneGameState({ ...state, version: nextVersion });
    this.games.set(gameId, newState);
    this.versions.set(gameId, nextVersion);
  }

  async appendEvents(gameId: EntityId, events: readonly DomainEvent[]): Promise<void> {
    const existing = this.events.get(gameId) ?? [];
    this.events.set(gameId, [...existing, ...cloneJson(events)]);
  }

  async getRecentEvents(gameId: EntityId, limit: number): Promise<readonly DomainEvent[]> {
    const all = this.events.get(gameId) ?? [];
    return cloneJson(all.slice(-limit));
  }

  recordRunMetrics(metrics: RunMetrics, _gameId?: string): void {
    this.runMetricsLog = [...this.runMetricsLog, cloneJson(metrics)];
  }

  getRunMetricsLog(): readonly RunMetrics[] {
    return cloneJson(this.runMetricsLog);
  }

  async commitTick(gameId: EntityId, prevVersion: number, nextState: GameState, events: readonly DomainEvent[]): Promise<void> {
    // Atomically verify, save state, and append events
    const currentVersion = this.versions.get(gameId);
    if (currentVersion !== prevVersion) {
      throw new Error(
        `Concurrent modification detected for game ${gameId}. ` +
          `Expected version ${prevVersion}, got ${currentVersion}. ` +
          `Please retry the command.`,
      );
    }

    // All-or-nothing: save state and events together
    const nextVersion = nextState.version;
    this.games.set(gameId, cloneGameState(nextState));
    this.versions.set(gameId, nextVersion);
    const existing = this.events.get(gameId) ?? [];
    this.events.set(gameId, [...existing, ...cloneJson(events)]);
  }
}
