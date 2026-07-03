import type { Position, GameState, EnemyInstance } from '@dungeon/contracts';
import { posKey, sortedCopy } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';
import { isWalkable } from './movement.js';

export type MovementBehaviorId = 'wall_stalker' | 'rearline_anchor' | 'chokepoint_holder' | 'ambush_idle';

interface TileScore {
  tile: Position;
  score: number;
}

/**
 * A movement behavior that scores tiles to decide where an enemy should move.
 * Scores higher = more desirable position for this behavior.
 */
interface MovementBehavior {
  readonly id: MovementBehaviorId;
  readonly name: string;
  readonly description: string;
  readonly scoreTiles: (enemy: EnemyInstance, tiles: Position[], state: GameState) => TileScore[];
}

/**
 * Registry of all available movement behaviors.
 * Eliminates if/else ladder and makes it trivial to add new behaviors.
 */
const MOVEMENT_BEHAVIOR_REGISTRY: readonly MovementBehavior[] = [
  {
    id: 'wall_stalker',
    name: 'Wall Stalker',
    description: 'Prefers tiles adjacent to walls (corners, edges). Stay hidden near cover.',
    scoreTiles: scoreWallStalker,
  },
  {
    id: 'rearline_anchor',
    name: 'Rearline Anchor',
    description: 'Prefers tiles far from player, stays back. Ranged/support positioning.',
    scoreTiles: scoreRearlineAnchor,
  },
  {
    id: 'chokepoint_holder',
    name: 'Chokepoint Holder',
    description: 'Prefers tiles close to player with good wall coverage. Melee/tank positioning.',
    scoreTiles: scoreChokepointHolder,
  },
  {
    id: 'ambush_idle',
    name: 'Ambush Idle',
    description: 'Prefers corners/walls with good distance from player. Lurking/waiting positioning.',
    scoreTiles: scoreAmbushIdle,
  },
];

/**
 * Look up a behavior by ID in the registry.
 * Returns undefined if behavior is not found.
 */
function getBehavior(id: string | undefined): MovementBehavior | undefined {
  if (id === undefined) return undefined;
  return MOVEMENT_BEHAVIOR_REGISTRY.find(b => b.id === id);
}

/**
 * Get all available movement behaviors.
 * Useful for UI/documentation and behavior analysis.
 */
export function getAllBehaviors(): readonly MovementBehavior[] {
  return MOVEMENT_BEHAVIOR_REGISTRY;
}

/**
 * Get metadata about a specific behavior.
 * Returns behavior details (name, description) without executing the scoring function.
 */
export function getBehaviorInfo(id: MovementBehaviorId): Omit<MovementBehavior, 'scoreTiles'> | undefined {
  const behavior = getBehavior(id);
  if (behavior === undefined) return undefined;
  return {
    id: behavior.id,
    name: behavior.name,
    description: behavior.description,
  };
}

/**
 * Get all walkable neighbor tiles (8-directional) around an enemy.
 */
export function getWalkableNeighbors(
  position: Position,
  state: GameState,
): Position[] {
  if (state.run === null) return [];

  const offsets = [-1, 0, 1] as const;
  return offsets.flatMap(dx =>
    offsets.flatMap((dy) => {
      if (dx === 0 && dy === 0) return [];
      const nextPos = { x: position.x + dx, y: position.y + dy };
      return isWalkable(state, nextPos) !== false ? [nextPos] : [];
    }),
  );
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
 * Uses the behavior registry to look up the behavior by ID.
 * Falls back to default approach if behavior not found.
 */
export function scoreTilesForBehavior(
  enemy: EnemyInstance,
  availableTiles: Position[],
  state: GameState,
  behaviorId?: string,
): Position | null {
  if (availableTiles.length === 0) return null;

  // Look up behavior in registry, or use default
  const behavior = getBehavior(behaviorId);
  const scoringFn = behavior?.scoreTiles ?? scoreDefaultApproach;
  const scores = scoringFn(enemy, availableTiles, state);

  if (scores.length === 0) return availableTiles[0] ?? null;

  // Sort by score descending and pick highest
  const sortedScores = sortedCopy(scores, (a, b) => b.score - a.score);
  return sortedScores[0]?.tile ?? null;
}

/**
 * Wall Stalker scoring function.
 * Prefers tiles adjacent to walls (corners, edges). Stay hidden near cover.
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
        if (neighborCell === undefined || neighborCell.tile.walkable !== true) {
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
        if (neighborCell === undefined || neighborCell.tile.walkable !== true) {
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
        if (neighborCell === undefined || neighborCell.tile.walkable !== true) {
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
