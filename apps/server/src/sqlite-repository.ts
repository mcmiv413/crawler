import Database from 'better-sqlite3';
import type { IGameRepository, GameState, EntityId, DomainEvent, RunMetrics } from '@dungeon/contracts';
import { serializeState, deserializeState } from '@dungeon/core';

export class SqliteRepository implements IGameRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        game_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_json TEXT NOT NULL,
        turn_number INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (game_id) REFERENCES games(game_id)
      );
      CREATE INDEX IF NOT EXISTS idx_events_game_id ON events(game_id);
      CREATE TABLE IF NOT EXISTS run_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT,
        metrics_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  async createGame(state: GameState): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO games (game_id, state_json, version) VALUES (?, ?, ?)',
    );
    stmt.run(state.gameId, serializeState(state), state.version);
  }

  async loadGame(gameId: EntityId): Promise<GameState | null> {
    const row = this.db
      .prepare('SELECT state_json FROM games WHERE game_id = ?')
      .get(gameId) as { state_json: string } | undefined;
    if (!row) return null;
    return deserializeState(row.state_json);
  }

  async saveGame(gameId: EntityId, state: GameState): Promise<void> {
    const stmt = this.db.prepare(
      "UPDATE games SET state_json = ?, version = ?, updated_at = datetime('now') WHERE game_id = ? AND version = ?",
    );
    const result = stmt.run(serializeState(state), state.version + 1, gameId, state.version);

    // Check if the update affected any rows (optimistic concurrency control)
    if (result.changes === 0) {
      throw new Error(`Concurrent modification detected for game ${gameId}. Please retry the command.`);
    }
  }

  async appendEvents(
    gameId: EntityId,
    events: readonly DomainEvent[],
  ): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO events (game_id, event_type, event_json, turn_number) VALUES (?, ?, ?, ?)',
    );
    const insertMany = this.db.transaction((evts: readonly DomainEvent[]) => {
      for (const event of evts) {
        stmt.run(
          gameId,
          event.type,
          JSON.stringify(event),
          event.turnNumber ?? 0,
        );
      }
    });
    insertMany(events);
  }

  async getRecentEvents(
    gameId: EntityId,
    limit: number,
  ): Promise<readonly DomainEvent[]> {
    const rows = this.db
      .prepare(
        'SELECT event_json FROM events WHERE game_id = ? ORDER BY id DESC LIMIT ?',
      )
      .all(gameId, limit) as { event_json: string }[];
    return rows.reverse().map((r) => JSON.parse(r.event_json));
  }

  recordRunMetrics(metrics: RunMetrics, gameId?: string): void {
    const stmt = this.db.prepare(
      'INSERT INTO run_metrics (game_id, metrics_json) VALUES (?, ?)',
    );
    stmt.run(gameId ?? null, JSON.stringify(metrics));
  }

  getRunMetricsLog(): readonly RunMetrics[] {
    const rows = this.db
      .prepare('SELECT metrics_json FROM run_metrics ORDER BY id')
      .all() as { metrics_json: string }[];
    return rows.map((r) => JSON.parse(r.metrics_json));
  }

  async commitTick(gameId: EntityId, prevVersion: number, nextState: GameState, events: readonly DomainEvent[]): Promise<void> {
    // Use a transaction to ensure both saveGame and appendEvents succeed atomically
    const commit = this.db.transaction(() => {
      // Step 1: Verify current version matches expected version
      const currentRow = this.db
        .prepare('SELECT version FROM games WHERE game_id = ?')
        .get(gameId) as { version: number } | undefined;

      if (!currentRow || currentRow.version !== prevVersion) {
        throw new Error(
          `Concurrent modification detected for game ${gameId}. ` +
            `Expected version ${prevVersion}, got ${currentRow?.version ?? 'not found'}. ` +
            `Please retry the command.`,
        );
      }

      // Step 2: Update state and version (same OCC check as saveGame)
      const updateStmt = this.db.prepare(
        "UPDATE games SET state_json = ?, version = ?, updated_at = datetime('now') WHERE game_id = ? AND version = ?",
      );
      const result = updateStmt.run(serializeState(nextState), prevVersion + 1, gameId, prevVersion);

      if (result.changes === 0) {
        throw new Error(
          `Concurrent modification detected for game ${gameId}. ` +
            `Expected version ${prevVersion}, got ${currentRow.version}. ` +
            `Please retry the command.`,
        );
      }

      // Step 3: Append events (same logic as appendEvents)
      const insertStmt = this.db.prepare(
        'INSERT INTO events (game_id, event_type, event_json, turn_number) VALUES (?, ?, ?, ?)',
      );
      for (const event of events) {
        insertStmt.run(gameId, event.type, JSON.stringify(event), event.turnNumber ?? 0);
      }
    });

    commit();
  }

  close(): void {
    this.db.close();
  }
}
