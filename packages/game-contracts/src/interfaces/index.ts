import type { GameState } from '../types/game-state.js';
import type { GameCommand } from '../commands/index.js';
import type { DomainEvent } from '../events/index.js';
import type { EntityId, RunMetrics } from '../types/common.js';

export interface CommandResult {
  readonly state: GameState;
  readonly events: readonly DomainEvent[];
  readonly runEnded: boolean;
}

export interface IGameEngine {
  createNewGame(seed: number): GameState;
  submitCommand(state: GameState, command: GameCommand): CommandResult;
}

export interface IGameRepository {
  createGame(state: GameState): Promise<void>;
  loadGame(gameId: EntityId): Promise<GameState | null>;

  /**
   * @deprecated Use commitTick for new code. Saves game state with OCC version check.
   * This method should only be called as part of commitTick for atomicity guarantees.
   */
  saveGame(gameId: EntityId, state: GameState): Promise<void>;

  /**
   * @deprecated Use commitTick for new code. Appends events to the event log.
   * Separate calls to saveGame + appendEvents can result in torn logs if a failure occurs between them.
   */
  appendEvents(gameId: EntityId, events: readonly DomainEvent[]): Promise<void>;
  getRecentEvents(gameId: EntityId, limit: number): Promise<readonly DomainEvent[]>;
  recordRunMetrics(metrics: RunMetrics, gameId?: string): void;
  getRunMetricsLog(): readonly RunMetrics[];

  /**
   * Atomically save state and append events in a single transaction.
   * Verifies that the game's current version matches prevVersion before proceeding.
   * If version mismatch, throws without modifying state or events (all-or-nothing semantics).
   *
   * Preferred over separate saveGame + appendEvents calls for new code.
   * Prevents torn event logs where state advances but events are lost.
   *
   * @param gameId Unique game identifier
   * @param prevVersion Expected current version (from state.version before this tick)
   * @param nextState New game state to persist (must have version = prevVersion + 1)
   * @param events New events that caused this state change
   * @throws Error if version mismatch (concurrent write detected)
   */
  commitTick(gameId: EntityId, prevVersion: number, nextState: GameState, events: readonly DomainEvent[]): Promise<void>;

  /**
   * Set the session token for a game. Used for server-side session isolation.
   */
  setGameSessionToken(gameId: EntityId, token: string): Promise<void>;

  /**
   * Get the session token for a game, or null if no token is set.
   */
  getGameSessionToken(gameId: EntityId): Promise<string | null>;
}

/** Stub for Phase 1+ AI narrative integration */
export interface INarrativeService {
  generateNpcDialogue(context: unknown): Promise<string>;
  generateRumor(context: unknown): Promise<string>;
  generateRunSummary(context: unknown): Promise<string>;
}

export interface IPresenter {
  buildGameView(state: GameState): GameViewModel;
}

/** Minimal view model type — full definition lives in @dungeon/presenter */
export interface GameViewModel {
  readonly gameId: string;
  readonly phase: string;
  readonly player: unknown;
  readonly map: unknown;
  readonly combatLog: readonly string[];
  readonly availableActions: readonly string[];
}
