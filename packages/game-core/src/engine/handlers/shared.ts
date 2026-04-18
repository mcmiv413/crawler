import type { GameState, DomainEvent, RunMetrics, StoredFloor } from '@dungeon/contracts';
import { EMPTY_RUN_METRICS } from '@dungeon/contracts';

export interface CommandResult {
  readonly state: GameState;
  readonly events: readonly DomainEvent[];
  readonly runEnded: boolean;
}

export function updateRunMetrics(
  state: GameState,
  updates: Partial<RunMetrics>,
): GameState {
  if (state.run === null) return state;
  const current = state.run.runMetrics ?? EMPTY_RUN_METRICS;
  return {
    ...state,
    run: {
      ...state.run,
      runMetrics: {
        ...current,
        damageDealt: current.damageDealt + (updates.damageDealt ?? 0),
        damageTaken: current.damageTaken + (updates.damageTaken ?? 0),
        turnsElapsed: current.turnsElapsed + (updates.turnsElapsed ?? 0),
        enemiesKilled: current.enemiesKilled + (updates.enemiesKilled ?? 0),
        itemsUsed: current.itemsUsed + (updates.itemsUsed ?? 0),
        goldEarned: current.goldEarned + (updates.goldEarned ?? 0),
        floorsCleared: current.floorsCleared + (updates.floorsCleared ?? 0),
        causeOfEnd: updates.causeOfEnd ?? current.causeOfEnd,
        consecutiveMisses: updates.consecutiveMisses ?? current.consecutiveMisses,
      },
    },
  };
}

export function updateFloorCacheForCurrentFloor(state: GameState): GameState {
  if (state.run === null) return state;
  const currentDepth = state.run.floor.depth;
  const floorSnapshot: StoredFloor = {
    floor: state.run.floor,
    enemies: state.run.enemies,
    objects: state.run.objects,
    playerPosition: state.player.position,
  };
  const newCache = new Map(state.run.floorCache ?? []);
  newCache.set(currentDepth, floorSnapshot);
  return {
    ...state,
    run: {
      ...state.run,
      floorCache: newCache,
    },
  };
}
