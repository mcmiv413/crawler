import type { GameState, StoredFloor } from '@dungeon/contracts';

export interface ActiveFloorSnapshotOptions {
  readonly enemies?: StoredFloor['enemies'];
  readonly originalEnemyCount?: number;
  readonly lastSimulatedTurn?: number;
}

export function snapshotActiveFloor(
  state: GameState,
  options: ActiveFloorSnapshotOptions = {},
): StoredFloor | null {
  if (state.run === null) return null;

  return {
    floor: state.run.floor,
    enemies: options.enemies ?? state.run.enemies,
    objects: state.run.objects,
    playerPosition: state.player.position,
    originalEnemyCount: options.originalEnemyCount,
    lastSimulatedTurn: options.lastSimulatedTurn,
  };
}

export function withPersistedFloor(
  state: GameState,
  depth: number,
  floor: StoredFloor,
): GameState {
  const persistedFloorCache = new Map(state.persistedFloorCache ?? []);
  persistedFloorCache.set(depth, floor);

  return {
    ...state,
    persistedFloorCache,
  };
}

export function withActiveFloorPersisted(
  state: GameState,
  options: ActiveFloorSnapshotOptions = {},
): GameState {
  const snapshot = snapshotActiveFloor(state, options);
  if (snapshot === null) return state;

  return withPersistedFloor(state, snapshot.floor.depth, snapshot);
}
