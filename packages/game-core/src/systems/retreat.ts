import type { GameState } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { EMPTY_RUN_METRICS, posKey } from '@dungeon/contracts';
import { randomizeShop } from '../state/world-state.js';
import type { SeededRNG } from '../utils/rng.js';
import { AMBIENT_PROFILES } from '@dungeon/content';
import { preSimulateAmbientBehavior } from './ambient-behavior-engine.js';
import { snapshotActiveFloor, withPersistedFloor } from '../state/floor-cache.js';

/** Check if the player can retreat (must be on stairs_up or entrance) */
export function canRetreat(state: GameState): boolean {
  if (state.run === null || state.phase !== 'dungeon') return false;

  const playerKey = posKey(state.player.position);
  const cell = state.run.floor.cells.get(playerKey);
  if (cell === undefined) return false;

  // Can retreat from entrance or stairs_up
  return cell.tile.type === 'stairs_up' ||
    (state.player.position.x === state.run.floor.entrance.x &&
     state.player.position.y === state.run.floor.entrance.y);
}

/** Execute retreat — end the run, return to town */
export function executeRetreat(state: GameState, rng: SeededRNG): { state: GameState; events: DomainEvent[] } {
  let events: DomainEvent[] = [];

  events = [...events, {
    type: 'RUN_ENDED',
    runId: state.run!.runId,
    reason: 'retreat',
    floorsCleared: state.player.floor - 1,
    timestamp: state.turnNumber,
    turnNumber: state.turnNumber,
  }];

  events = [...events, {
    type: 'PHASE_CHANGED',
    from: 'dungeon',
    to: 'town',
    timestamp: state.turnNumber,
    turnNumber: state.turnNumber,
  }];

  // Simulate enemy movement while player is in town (5 turns worth)
  // This makes the dungeon feel alive when the player returns
  const simulatedEnemies = preSimulateAmbientBehavior(
    new Map(state.run!.enemies),
    state.run!.floor,
    AMBIENT_PROFILES,
    5, // Simulate 5 turns while in town
    state.run!.floor.seed,
  );

  // Save the current floor to persistedFloorCache before clearing the run
  const currentFloorDepth = state.player.floor;
  const currentFloorSnapshot = snapshotActiveFloor(state, {
    enemies: simulatedEnemies,
    originalEnemyCount: state.run!.enemies.size,
    lastSimulatedTurn: state.turnNumber,
  })!;
  const stateWithPersistedFloor = withPersistedFloor(state, currentFloorDepth, currentFloorSnapshot);

  const finalRunMetrics = {
    ...(state.run!.runMetrics ?? EMPTY_RUN_METRICS),
    causeOfEnd: 'retreat' as const,
    floorsCleared: state.player.floor - 1,
  };

  return {
    state: {
      ...stateWithPersistedFloor,
      phase: 'town',
      run: null,
      lastRetreatFloor: currentFloorDepth,
      lastRunMetrics: finalRunMetrics,
      player: {
        ...state.player,
        totalRuns: state.player.totalRuns + 1,
      },
      world: {
        ...state.world,
        shop: randomizeShop(rng),
      },
    },
    events,
  };
}
