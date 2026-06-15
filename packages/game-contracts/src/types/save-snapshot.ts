import type { EntityId, GamePhase, Position, RunMetrics, WeaponMastery } from './common.js';
import type { Player } from './player.js';
import type { EnemyInstance } from './enemy.js';
import type { ObjectInstance } from './objects.js';
import type { MapCell } from './map.js';
import type { Quest } from './town.js';
import type { WorldState } from './game-state.js';
import type { AnyItemTemplate } from './items.js';

export const SAVE_SNAPSHOT_SCHEMA_VERSION = 1;

export interface SerializedDungeonFloor {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly biomeId: string;
  readonly cells: Readonly<Record<string, MapCell>>;
  readonly entrance: Position;
  readonly exit: Position;
  readonly seed: number;
}

export interface SaveSnapshotStoredFloor {
  readonly floor: SerializedDungeonFloor;
  readonly enemies: Readonly<Record<string, EnemyInstance>>;
  readonly objects: Readonly<Record<string, ObjectInstance>>;
  readonly playerPosition: Position;
  readonly originalEnemyCount?: number;
  readonly lastSimulatedTurn?: number;
}

export interface SaveSnapshotRun {
  readonly runId: EntityId;
  readonly turnCount: number;
  readonly isActive: boolean;
  readonly runMetrics?: RunMetrics;
  readonly speedAccumulators: Readonly<Record<EntityId, number>>;
}

export interface SaveSnapshotMetadata {
  readonly saveTimestamp: number;
  readonly characterLevel: number;
  readonly currentFloor: number;
  readonly displayName?: string;
}

export interface SaveSnapshotItemRegistry {
  readonly items: Readonly<Record<string, AnyItemTemplate>>;
}

export interface SaveSnapshot {
  readonly schemaVersion: typeof SAVE_SNAPSHOT_SCHEMA_VERSION;
  readonly metadata: SaveSnapshotMetadata;
  readonly gameId: EntityId;
  readonly phase: GamePhase;
  readonly player: Player;
  readonly world: WorldState;
  readonly run: SaveSnapshotRun | null;
  readonly floor: SerializedDungeonFloor | null;
  readonly enemies: Readonly<Record<string, EnemyInstance>>;
  readonly objects: Readonly<Record<string, ObjectInstance>>;
  readonly itemRegistry: SaveSnapshotItemRegistry;
  readonly seed: number;
  readonly turnNumber: number;
  readonly version: number;
  readonly activeQuests: readonly Quest[];
  readonly persistedFloorCache?: Readonly<Record<string, SaveSnapshotStoredFloor>>;
  readonly lastRetreatFloor?: number;
  readonly lastRunMetrics?: RunMetrics;
  readonly weaponMastery: WeaponMastery;
}

export interface SaveSnapshotValidationError {
  readonly field: string;
  readonly message: string;
}

export interface SaveSnapshotValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly SaveSnapshotValidationError[];
}
