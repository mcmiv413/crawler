import type {
  AnyItemTemplate,
  DungeonFloor,
  EnemyInstance,
  EntityId,
  GameState,
  MapCell,
  ObjectInstance,
  RunState,
  SaveSnapshot,
  SaveSnapshotRun,
  SaveSnapshotStoredFloor,
  SerializedDungeonFloor,
  StoredFloor,
} from '@dungeon/contracts';
import { SAVE_SNAPSHOT_SCHEMA_VERSION } from '@dungeon/contracts';
import {
  migrateSaveSnapshot,
  SaveSnapshotLoadError,
  validateSaveSnapshot,
} from './save-snapshot-validation.js';

export { SAVE_SNAPSHOT_SCHEMA_VERSION };
export {
  migrateSaveSnapshot,
  SaveSnapshotLoadError,
  validateSaveSnapshot,
};

export function exportSaveSnapshot(state: GameState): SaveSnapshot {
  const activeRun = state.run;

  return {
    schemaVersion: SAVE_SNAPSHOT_SCHEMA_VERSION,
    metadata: {
      saveTimestamp: state.turnNumber,
      characterLevel: state.player.level,
      currentFloor: state.player.floor,
      ...(state.player.name.length > 0 ? { displayName: state.player.name } : {}),
    },
    gameId: state.gameId,
    phase: state.phase,
    player: cloneJson(state.player),
    world: cloneJson(state.world),
    run: activeRun !== null ? serializeRunMetadata(activeRun) : null,
    floor: activeRun !== null ? serializeFloor(activeRun.floor) : null,
    enemies: activeRun !== null ? mapToSortedRecord(activeRun.enemies, cloneJson) : {},
    objects: activeRun !== null ? mapToSortedRecord(activeRun.objects, cloneJson) : {},
    itemRegistry: {
      items: mapToSortedRecord(state.itemRegistry.items, cloneJson),
    },
    seed: state.seed,
    turnNumber: state.turnNumber,
    version: state.version,
    activeQuests: cloneJson(state.activeQuests),
    ...(state.persistedFloorCache !== undefined
      ? { persistedFloorCache: mapToSortedRecord(state.persistedFloorCache, serializeStoredFloor) }
      : {}),
    ...(state.lastRetreatFloor !== undefined ? { lastRetreatFloor: state.lastRetreatFloor } : {}),
    ...(state.lastRunMetrics !== undefined ? { lastRunMetrics: cloneJson(state.lastRunMetrics) } : {}),
    weaponMastery: cloneJson(state.weaponMastery),
  };
}

export function loadSaveSnapshot(snapshot: unknown): GameState {
  const validation = validateSaveSnapshot(snapshot);
  if (validation.isValid === false) {
    throw new SaveSnapshotLoadError(validation.errors);
  }

  const migrated = migrateSaveSnapshot(snapshot);
  const run = migrated.run !== null
    ? deserializeRun(migrated.run, migrated.floor!, migrated.enemies, migrated.objects)
    : null;

  return {
    gameId: migrated.gameId,
    phase: migrated.phase,
    player: cloneJson(migrated.player),
    run,
    world: cloneJson(migrated.world),
    itemRegistry: {
      items: new Map(Object.entries(migrated.itemRegistry.items)) as unknown as ReadonlyMap<EntityId, AnyItemTemplate>,
    },
    seed: migrated.seed,
    turnNumber: migrated.turnNumber,
    version: migrated.version,
    activeQuests: cloneJson(migrated.activeQuests),
    ...(migrated.persistedFloorCache !== undefined
      ? {
          persistedFloorCache: new Map(
            Object.entries(migrated.persistedFloorCache).map(([depth, floor]) => [
              Number(depth),
              deserializeStoredFloor(floor),
            ]),
          ) as ReadonlyMap<number, StoredFloor>,
        }
      : {}),
    ...(migrated.lastRetreatFloor !== undefined ? { lastRetreatFloor: migrated.lastRetreatFloor } : {}),
    ...(migrated.lastRunMetrics !== undefined ? { lastRunMetrics: cloneJson(migrated.lastRunMetrics) } : {}),
    weaponMastery: cloneJson(migrated.weaponMastery),
  };
}

function serializeRunMetadata(run: RunState): SaveSnapshotRun {
  return {
    runId: run.runId,
    turnCount: run.turnCount,
    isActive: run.isActive,
    ...(run.runMetrics !== undefined ? { runMetrics: cloneJson(run.runMetrics) } : {}),
    speedAccumulators: sortRecord(run.speedAccumulators),
  };
}

function serializeStoredFloor(storedFloor: StoredFloor): SaveSnapshotStoredFloor {
  return {
    floor: serializeFloor(storedFloor.floor),
    enemies: mapToSortedRecord(storedFloor.enemies, cloneJson),
    objects: mapToSortedRecord(storedFloor.objects, cloneJson),
    playerPosition: cloneJson(storedFloor.playerPosition),
    ...(storedFloor.originalEnemyCount !== undefined ? { originalEnemyCount: storedFloor.originalEnemyCount } : {}),
    ...(storedFloor.lastSimulatedTurn !== undefined ? { lastSimulatedTurn: storedFloor.lastSimulatedTurn } : {}),
  };
}

function serializeFloor(floor: DungeonFloor): SerializedDungeonFloor {
  return {
    width: floor.width,
    height: floor.height,
    depth: floor.depth,
    biomeId: floor.biomeId,
    cells: mapToSortedRecord(floor.cells, cloneJson),
    entrance: cloneJson(floor.entrance),
    exit: cloneJson(floor.exit),
    seed: floor.seed,
  };
}

function deserializeRun(
  run: SaveSnapshotRun,
  floor: SerializedDungeonFloor,
  enemies: Readonly<Record<string, EnemyInstance>>,
  objects: Readonly<Record<string, ObjectInstance>>,
): RunState {
  return {
    runId: run.runId,
    floor: deserializeFloor(floor),
    enemies: new Map(Object.entries(enemies)) as ReadonlyMap<string, EnemyInstance>,
    objects: new Map(Object.entries(objects)) as ReadonlyMap<string, ObjectInstance>,
    turnCount: run.turnCount,
    isActive: run.isActive,
    ...(run.runMetrics !== undefined ? { runMetrics: cloneJson(run.runMetrics) } : {}),
    speedAccumulators: cloneJson(run.speedAccumulators),
  };
}

function deserializeStoredFloor(storedFloor: SaveSnapshotStoredFloor): StoredFloor {
  return {
    floor: deserializeFloor(storedFloor.floor),
    enemies: new Map(Object.entries(storedFloor.enemies)) as ReadonlyMap<string, EnemyInstance>,
    objects: new Map(Object.entries(storedFloor.objects)) as ReadonlyMap<string, ObjectInstance>,
    playerPosition: cloneJson(storedFloor.playerPosition),
    ...(storedFloor.originalEnemyCount !== undefined ? { originalEnemyCount: storedFloor.originalEnemyCount } : {}),
    ...(storedFloor.lastSimulatedTurn !== undefined ? { lastSimulatedTurn: storedFloor.lastSimulatedTurn } : {}),
  };
}

function deserializeFloor(floor: SerializedDungeonFloor): DungeonFloor {
  return {
    ...cloneJson(floor),
    cells: new Map(Object.entries(floor.cells)) as ReadonlyMap<string, MapCell>,
  };
}

function mapToSortedRecord<T, U>(
  map: ReadonlyMap<string | number, T>,
  convert: (value: T) => U,
): Record<string, U> {
  const mutableEntries = [...map.entries()];
  return Object.fromEntries(
    mutableEntries
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([key, value]) => [String(key), convert(value)]),
  );
}

function sortRecord<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  const mutableEntries = Object.entries(record);
  return Object.fromEntries(
    mutableEntries.sort(([left], [right]) => left.localeCompare(right)),
  );
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
