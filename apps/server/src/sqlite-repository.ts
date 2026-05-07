import Database from 'better-sqlite3';
import type { IGameRepository, GameState, EntityId, DomainEvent, RunMetrics } from '@dungeon/contracts';
import { SchemaVersionMismatchError, SchemaParseError } from '@dungeon/contracts';
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

    try {
      return deserializeState(row.state_json);
    } catch (error) {
      // Re-throw schema validation errors with additional context
      if (error instanceof SchemaVersionMismatchError || error instanceof SchemaParseError) {
        throw error; // Let app.ts handle these for proper HTTP responses
      }
      throw error; // Other errors propagate as-is
    }
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
//HUMANNOTE:   1. Inconsistent Error Handling: In saveGame() and commitTick(), you're throwing generic Error objects, but in loadGame() you're properly re-throwing specific schema validation errors. This creates inconsistency in error handling.
  // 2. Potential SQL Injection Vulnerability: While you're using prepared statements, in commitTick() you're constructing SQL strings with string interpolation for error messages, which could be a security risk if user input is involved.
  // 3. Duplicated Logic: The event insertion logic is duplicated between appendEvents() and commitTick() - both have similar code for inserting events.
  // 4. Missing Input Validation: There's no validation of the gameId parameter in loadGame() or saveGame() to ensure it's not null/undefined.
  // 5. Potential Performance Issue: In getRecentEvents(), you're using rows.reverse().map() which creates an unnecessary array copy and mapping operation.
  // 6. Error Message Clarity: In commitTick(), the error messages could be more specific about what went wrong.
  // 7. Resource Management: While you have a close() method, there's no explicit handling of database connection errors or graceful shutdown.