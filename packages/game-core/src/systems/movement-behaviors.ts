import type { Position, GameState, EnemyInstance } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';
import { isWalkable } from './movement.js';

export type MovementBehaviorId = 'wall_stalker' | 'rearline_anchor' | 'chokepoint_holder' | 'ambush_idle';

interface TileScore {
  tile: Position;
  score: number;
}

/**
 * Get all walkable neighbor tiles (8-directional) around an enemy.
 */
export function getWalkableNeighbors(
  position: Position,
  state: GameState,
): Position[] {
  if (state.run === null) return [];

  const mutableNeighbors: Position[] = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nextPos = { x: position.x + dx, y: position.y + dy };
      if (isWalkable(state, nextPos) === true) {
        mutableNeighbors.push(nextPos);
      }
    }
  }

  return mutableNeighbors;
}

/**
 * Decide enemy movement based on behavior.
 * Called when no combat action is viable (behavior influences positioning, not attacking).
 * Falls back to approach-player if no behavior assigned.
 */
export function decideMovementByBehavior(
  enemy: EnemyInstance,
  state: GameState,
): Position | null {
  const neighbors = getWalkableNeighbors(enemy.position, state);
  if (neighbors.length === 0) return null;

  const behaviorId = enemy.movementBehaviorId;
  return scoreTilesForBehavior(enemy, neighbors, state, behaviorId);
}

/**
 * Score walkable neighbor tiles according to a behavior strategy.
 * Used to influence enemy positioning when no combat action is selected.
 */
export function scoreTilesForBehavior(
  enemy: EnemyInstance,
  availableTiles: Position[],
  state: GameState,
  behaviorId?: string,
): Position | null {
  if (availableTiles.length === 0) return null;

  const behavior = behaviorId as MovementBehaviorId | undefined;

  let scores: TileScore[] = [];

  if (behavior === 'wall_stalker') {
    scores = scoreWallStalker(enemy, availableTiles, state);
  } else if (behavior === 'rearline_anchor') {
    scores = scoreRearlineAnchor(enemy, availableTiles, state);
  } else if (behavior === 'chokepoint_holder') {
    scores = scoreChokepointHolder(enemy, availableTiles, state);
  } else if (behavior === 'ambush_idle') {
    scores = scoreAmbushIdle(enemy, availableTiles, state);
  } else {
    // No behavior or unknown behavior — default to approach player
    scores = scoreDefaultApproach(enemy, availableTiles, state);
  }

  if (scores.length === 0) return availableTiles[0] ?? null;

  // Sort by score descending and pick highest
  const mutableScores = [...scores];
  mutableScores.sort((a, b) => b.score - a.score);
  return mutableScores[0]?.tile ?? null;
}

/**
 * Wall Stalker: Prefers tiles adjacent to walls (corners, edges).
 * Stay hidden near cover.
 */
function scoreWallStalker(
  _enemy: EnemyInstance,
  availableTiles: Position[],
  state: GameState,
): TileScore[] {
  if (state.run === null) return availableTiles.map(tile => ({ tile, score: 0 }));

  const floor = state.run.floor;
  return availableTiles.map(tile => {
    // Count wall-adjacent neighbors
    let wallProximity = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const neighborKey = posKey({ x: tile.x + dx, y: tile.y + dy });
        const neighborCell = floor.cells.get(neighborKey);
        if (neighborCell === undefined || neighborCell.tile.walkable === false) {
          wallProximity += 1; // Wall or out of bounds
        }
      }
    }
    return { tile, score: wallProximity };
  });
}

/**
 * Rearline Anchor: Prefers tiles far from player, stays back.
 * Ranged/support positioning.
 */
function scoreRearlineAnchor(
  _enemy: EnemyInstance,
  availableTiles: Position[],
  state: GameState,
): TileScore[] {
  const playerPos = state.player.position;
  return availableTiles.map(tile => {
    const dist = chebyshevDistance(tile, playerPos);
    // Prefer being far away
    return { tile, score: dist };
  });
}

/**
 * Chokepoint Holder: Prefers tiles close to player with good wall coverage.
 * Melee/tank positioning — hold ground.
 */
function chokepointHolder(
  _enemy: EnemyInstance,
  availableTiles: Position[],
  state: GameState,
): TileScore[] {
  if (state.run === null) return availableTiles.map(tile => ({ tile, score: 0 }));

  const playerPos = state.player.position;
  const floor = state.run.floor;

  return availableTiles.map(tile => {
    const dist = chebyshevDistance(tile, playerPos);
    // Prefer being close (within 2 tiles)
    const distScore = dist <= 2 ? 10 - dist : 0;

    // Count wall neighbors
    let wallProximity = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const neighborKey = posKey({ x: tile.x + dx, y: tile.y + dy });
        const neighborCell = floor.cells.get(neighborKey);
        if (neighborCell === undefined || neighborCell.tile.walkable === false) {
          wallProximity += 1;
        }
      }
    }

    return { tile, score: distScore + wallProximity * 0.5 };
  });
}

/**
 * Typo fix wrapper for chokepoint_holder behavior
 */
function scoreChokepointHolder(
  enemy: EnemyInstance,
  availableTiles: Position[],
  state: GameState,
): TileScore[] {
  return chokepointHolder(enemy, availableTiles, state);
}

/**
 * Ambush Idle: Prefers corners/walls with good distance from player.
 * Lurking/waiting positioning.
 */
function scoreAmbushIdle(
  _enemy: EnemyInstance,
  availableTiles: Position[],
  state: GameState,
): TileScore[] {
  if (state.run === null) return availableTiles.map(tile => ({ tile, score: 0 }));

  const playerPos = state.player.position;
  const floor = state.run.floor;

  return availableTiles.map(tile => {
    const dist = chebyshevDistance(tile, playerPos);
    // Prefer being far (3+ tiles away)
    const distScore = dist >= 3 ? dist : 0;

    // Count wall neighbors (good cover)
    let wallProximity = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const neighborKey = posKey({ x: tile.x + dx, y: tile.y + dy });
        const neighborCell = floor.cells.get(neighborKey);
        if (neighborCell === undefined || neighborCell.tile.walkable === false) {
          wallProximity += 1;
        }
      }
    }

    return { tile, score: distScore + wallProximity };
  });
}

/**
 * Default: Approach player if no behavior is assigned
 */
function scoreDefaultApproach(
  _enemy: EnemyInstance,
  availableTiles: Position[],
  state: GameState,
): TileScore[] {
  const playerPos = state.player.position;
  return availableTiles.map(tile => {
    // Prefer moving closer to player
    const dist = chebyshevDistance(tile, playerPos);
    return { tile, score: -dist }; // Negative so closer = higher score
  });
}
