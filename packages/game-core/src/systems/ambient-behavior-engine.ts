import type {
  DungeonFloor,
  EnemyInstance,
  GameState,
  Position,
  AmbientBehaviorProfile,
  AmbientState,
  EntityId,
} from '@dungeon/contracts';
import type { EnemyAction } from './enemy-ai.js';
import { chebyshevDistance, getNeighbors, positionsEqual, keyToPosition } from '../utils/grid.js';
import { isWalkable } from './movement.js';
import { posKey } from '@dungeon/contracts';
import { SeededRNG } from '../utils/rng.js';

/**
 * Evaluate all walkable tiles and score them based on profile preferences
 */
export function scoreTiles(
  enemy: EnemyInstance,
  profile: AmbientBehaviorProfile,
  state: GameState,
): Map<string, number> {
  if (state.run === null) return new Map();

  const floor = state.run.floor;
  const scores = new Map<string, number>();
  const prefs = profile.tilePreferences;

  // Collect all ally positions for social clustering
  const alliesOfSameType = new Map<EntityId, Position>();
  const alliesOfOtherTypes = new Map<EntityId, Position>();

  state.run.enemies.forEach((ally) => {
    if (ally.id !== enemy.id) {
      if (ally.archetype === enemy.archetype) {
        alliesOfSameType.set(ally.id, ally.position);
      } else {
        alliesOfOtherTypes.set(ally.id, ally.position);
      }
    }
  });

  const playerPos = state.player.position;

  // Score all walkable tiles
  for (const [key, cell] of floor.cells.entries()) {
    if (cell.tile.walkable === false) continue;

    const pos = keyToPosition(key);
    let score = 0;

    // Wall adjacency (0-1)
    if (prefs.wallAdjacency !== undefined && prefs.wallAdjacency > 0) {
      const wallCount = getNeighbors(pos).filter((n) => {
        const key = posKey(n);
        const c = floor.cells.get(key);
        return c === undefined || !c.tile.walkable;
      }).length;
      const wallScore = Math.min(wallCount / 4, 1); // max 4 walls around
      score += wallScore * prefs.wallAdjacency;
    }

    // Doorway proximity (prefer being near doors)
    if (prefs.doorwayProximity !== undefined && prefs.doorwayProximity > 0) {
      // For now, approximate: tiles near edges of rooms are "doorway-like"
      // A simple heuristic: count walkable neighbors (high count = open area/doorway)
      const walkableCount = getNeighbors(pos).filter((n) => {
        const key = posKey(n);
        const c = floor.cells.get(key);
        return c !== undefined && c.tile.walkable === true;
      }).length;
      const doorScore = walkableCount / 8; // normalize to 0-1
      score += doorScore * prefs.doorwayProximity;
    }

    // Open space (prefer lots of walkable neighbors)
    if (prefs.openSpace !== undefined && prefs.openSpace > 0) {
      const walkableCount = getNeighbors(pos).filter((n) => {
        const key = posKey(n);
        const c = floor.cells.get(key);
        return c !== undefined && c.tile.walkable === true;
      }).length;
      const openScore = walkableCount / 8;
      score += openScore * prefs.openSpace;
    }

    // Nested cells (prefer enclosed/safe - opposite of open space)
    if (prefs.nestedCells !== undefined && prefs.nestedCells > 0) {
      const wallCount = getNeighbors(pos).filter((n) => {
        const key = posKey(n);
        const c = floor.cells.get(key);
        return c === undefined || !c.tile.walkable;
      }).length;
      const nestedScore = wallCount / 8;
      score += nestedScore * prefs.nestedCells;
    }

    // Same species proximity (cluster together)
    if (prefs.sameSpeciesProximity !== undefined && prefs.sameSpeciesProximity > 0) {
      const socialRadius = profile.socialRadius ?? 5;
      const nearbyAllies = Array.from(alliesOfSameType.values()).filter(
        (allyPos) => chebyshevDistance(pos, allyPos) <= socialRadius,
      ).length;
      const clusterScore = Math.min(nearbyAllies / (profile.groupMaxSize ?? 7), 1);
      score += clusterScore * prefs.sameSpeciesProximity;
    }

    // Other enemy avoidance (stay away from other types)
    if (prefs.otherEnemyAvoidance !== undefined && prefs.otherEnemyAvoidance > 0) {
      const socialRadius = profile.socialRadius ?? 5;
      const nearbyOthers = Array.from(alliesOfOtherTypes.values()).filter(
        (otherPos) => chebyshevDistance(pos, otherPos) <= socialRadius,
      ).length;
      const avoidScore = 1 - Math.min(nearbyOthers / 5, 1); // invert: fewer others = higher score
      score += avoidScore * prefs.otherEnemyAvoidance;
    }

    // Player last seen distance (approach or avoid)
    if (prefs.playerLastSeenDistance !== undefined && prefs.playerLastSeenDistance !== 0) {
      const dist = chebyshevDistance(pos, playerPos);
      const maxDist = 10;
      if (prefs.playerLastSeenDistance > 0) {
        // approach player
        score += (1 - Math.min(dist / maxDist, 1)) * prefs.playerLastSeenDistance;
      } else {
        // avoid player (negative weight)
        score += Math.min(dist / maxDist, 1) * Math.abs(prefs.playerLastSeenDistance);
      }
    }

    scores.set(posKey(pos), score);
  }

  return scores;
}

/**
 * Analyze nearby enemies and return social state
 */
export function analyzeSocialState(
  enemy: EnemyInstance,
  profile: AmbientBehaviorProfile,
  state: GameState,
): {
  readonly sameTypeCount: number;
  readonly otherTypeCount: number;
  readonly nearestAllyPos: Position | null;
} {
  if (state.run === null) {
    return { sameTypeCount: 0, otherTypeCount: 0, nearestAllyPos: null };
  }

  const socialRadius = profile.socialRadius ?? 5;
  let sameTypeCount = 0;
  let otherTypeCount = 0;
  let nearestAllyPos: Position | null = null;
  let minDist = Infinity;

  state.run.enemies.forEach((ally) => {
    if (ally.id === enemy.id) return;

    const dist = chebyshevDistance(enemy.position, ally.position);
    if (dist > socialRadius) return;

    if (ally.archetype === enemy.archetype) {
      sameTypeCount++;
    } else {
      otherTypeCount++;
    }

    if (dist < minDist) {
      minDist = dist;
      nearestAllyPos = ally.position;
    }
  });

  return { sameTypeCount, otherTypeCount, nearestAllyPos };
}

/**
 * Check if a state transition condition is met
 */
export function shouldTransition(
  enemy: EnemyInstance,
  profile: AmbientBehaviorProfile,
  rule: AmbientBehaviorProfile['stateTransitions'][0],
  state: GameState,
  rng: SeededRNG,
): boolean {
  if (enemy.ambientState !== rule.from) return false;

  const stateAge = enemy.ambientStateAge ?? 0;

  switch (rule.trigger) {
    case 'time_elapsed': {
      const cooldown = rule.cooldownTurns ?? 3;
      return stateAge >= cooldown;
    }

    case 'ally_nearby': {
      const social = analyzeSocialState(enemy, profile, state);
      const minSize = profile.groupMinSize ?? 3;
      return social.sameTypeCount >= minSize - 1; // -1 because we don't count self
    }

    case 'no_allies': {
      const social = analyzeSocialState(enemy, profile, state);
      return social.sameTypeCount === 0;
    }

    case 'disturbance_heard': {
      // For now, never trigger (would need sound propagation system)
      return false;
    }

    case 'random_wander': {
      const prob = rule.probability ?? 0.1;
      return rng.next() < prob;
    }

    default:
      return false;
  }
}

/**
 * Pick the best tile for movement based on scores
 */
function pickBestTile(
  scores: Map<string, number>,
  walkableTiles: Position[],
  currentPos: Position,
  rng: SeededRNG,
  wanderIntensity: number,
): Position {
  if (walkableTiles.length === 0) return currentPos;

  // Apply randomness based on wanderIntensity
  if (rng.next() < wanderIntensity) {
    // Pick random tile instead of best
    return walkableTiles[Math.floor(rng.next() * walkableTiles.length)]!;
  }

  // Find tile with highest score
  let bestTile = walkableTiles[0]!;
  let bestScore = scores.get(posKey(bestTile)) ?? 0;

  for (const tile of walkableTiles) {
    const score = scores.get(posKey(tile)) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestTile = tile;
    }
  }

  return bestTile;
}

type AmbientStateChangedEvent = {
  type: 'ENEMY_AMBIENT_STATE_CHANGED';
  enemyId: EntityId;
  enemyName: string;
  oldState: AmbientState;
  newState: AmbientState;
  reason: string;
  timestamp: number;
  turnNumber: number;
};

/**
 * Decide ambient action for an enemy
 * Returns movement or wait action + any state transition events
 */
export function decideAmbientAction(
  enemy: EnemyInstance,
  profile: AmbientBehaviorProfile,
  state: GameState,
  rng: SeededRNG,
): { action: EnemyAction; updatedEnemy: EnemyInstance; stateChangeEvent: AmbientStateChangedEvent | null } {
  if (state.run === null) {
    return {
      action: { type: 'wait', enemyId: enemy.id },
      updatedEnemy: { ...enemy, ambientStateAge: (enemy.ambientStateAge ?? 0) + 1 },
      stateChangeEvent: null,
    };
  }

  const currentState = enemy.ambientState ?? profile.defaultState;
  let nextState = currentState;
  let stateChangeEvent: AmbientStateChangedEvent | null = null;

  // Check for state transitions
  for (const rule of profile.stateTransitions) {
    if (shouldTransition(enemy, profile, rule, state, rng)) {
      if (currentState === rule.from) {
        nextState = rule.to;
        stateChangeEvent = {
          type: 'ENEMY_AMBIENT_STATE_CHANGED' as const,
          enemyId: enemy.id,
          enemyName: enemy.name,
          oldState: currentState,
          newState: nextState,
          reason: rule.trigger,
          timestamp: state.turnNumber,
          turnNumber: state.turnNumber,
        };
        break; // Only transition once per turn
      }
    }
  }

  // Get current position and anchor
  const currentPos = enemy.position;
  const anchorPos = enemy.anchorPosition ?? currentPos;

  // Get walkable neighbors
  const neighbors = getNeighbors(currentPos).filter((pos) => {
    return isWalkable(state, pos);
  });

  const wanderIntensity = profile.wanderIntensity ?? 0.3;
  const scoreMap = scoreTiles(enemy, profile, state);

  // Action selection based on NEXT state (after any transition)
  let action: EnemyAction;
  switch (nextState) {
    case 'hiding': {
      // Move to highest-scored tile (preferring hidden positions)
      const bestTile = pickBestTile(scoreMap, neighbors, currentPos, rng, wanderIntensity);
      action = positionsEqual(bestTile, currentPos)
        ? { type: 'wait', enemyId: enemy.id }
        : { type: 'move', enemyId: enemy.id, targetPosition: bestTile };
      break;
    }

    case 'roaming': {
      // Move with randomness
      const bestTile = pickBestTile(scoreMap, neighbors, currentPos, rng, wanderIntensity);
      action = positionsEqual(bestTile, currentPos)
        ? { type: 'wait', enemyId: enemy.id }
        : { type: 'move', enemyId: enemy.id, targetPosition: bestTile };
      break;
    }

    case 'regrouping': {
      // Move toward nearest ally
      const social = analyzeSocialState(enemy, profile, state);
      if (social.nearestAllyPos && !positionsEqual(social.nearestAllyPos, currentPos)) {
        // Pick neighbor closest to ally
        let bestNeighbor = neighbors[0] ?? currentPos;
        let minDist = chebyshevDistance(bestNeighbor, social.nearestAllyPos);

        for (const neighbor of neighbors) {
          const dist = chebyshevDistance(neighbor, social.nearestAllyPos);
          if (dist < minDist) {
            minDist = dist;
            bestNeighbor = neighbor;
          }
        }

        action = { type: 'move', enemyId: enemy.id, targetPosition: bestNeighbor };
      } else {
        action = { type: 'wait', enemyId: enemy.id };
      }
      break;
    }

    case 'guarding':
    case 'patrolling': {
      // Move toward anchor if drifted away
      const anchorDist = chebyshevDistance(currentPos, anchorPos);
      const maxDist = profile.anchorRadius ?? 7;

      if (anchorDist > maxDist) {
        // Pick neighbor closest to anchor
        let bestNeighbor = neighbors[0] ?? currentPos;
        let minDist = chebyshevDistance(bestNeighbor, anchorPos);

        for (const neighbor of neighbors) {
          const dist = chebyshevDistance(neighbor, anchorPos);
          if (dist < minDist) {
            minDist = dist;
            bestNeighbor = neighbor;
          }
        }

        action = { type: 'move', enemyId: enemy.id, targetPosition: bestNeighbor };
      } else {
        action = { type: 'wait', enemyId: enemy.id };
      }
      break;
    }

    case 'stalking':
    case 'returning_to_anchor': {
      // Stalking: move toward player last known position (reuse roaming fallback for now)
      // Returning to anchor: reuse guarding/patrolling anchor logic
      const bestTile = pickBestTile(scoreMap, neighbors, currentPos, rng, wanderIntensity);
      action = positionsEqual(bestTile, currentPos)
        ? { type: 'wait', enemyId: enemy.id }
        : { type: 'move', enemyId: enemy.id, targetPosition: bestTile };
      break;
    }

    case 'idle':
    case 'dormant':
    default: {
      action = { type: 'wait', enemyId: enemy.id };
      break;
    }
  }

  // Update enemy with new ambient state and age
  const updatedEnemy: EnemyInstance = {
    ...enemy,
    ambientState: nextState,
    ambientStateAge: stateChangeEvent !== null ? 0 : (enemy.ambientStateAge ?? 0) + 1,
  };

  return { action, updatedEnemy, stateChangeEvent };
}

/**
 * Run pre-simulation: apply ambient behavior for N rounds to position enemies naturally
 * Used when a floor is first entered to give enemies "history" of movement
 */
export function preSimulateAmbientBehavior(
  enemies: Map<string, EnemyInstance>,
  floor: DungeonFloor,
  profiles: ReadonlyMap<string, AmbientBehaviorProfile>,
  rounds: number,
  seed: number,
): Map<string, EnemyInstance> {
  const rng = new SeededRNG(seed);
  let simEnemies = new Map(enemies);
  const walkablePositions = new Set(
    Array.from(floor.cells.entries())
      .filter(([, cell]) => cell.tile.walkable === true)
      .map(([key]) => key),
  );

  for (let round = 0; round < rounds; round++) {
    const newEnemies = new Map<string, EnemyInstance>();
    const occupied = new Set<string>();

    for (const [key, enemy] of simEnemies) {
      const profileId = enemy.ambientBehaviorProfile;
      const profile = profileId != null ? profiles.get(profileId) : undefined;
      if (profile === undefined) {
        // No profile: keep enemy as-is
        newEnemies.set(key, enemy);
        occupied.add(key);
        continue;
      }

      // Create minimal state for action decision
      const currentState = enemy.ambientState ?? profile.defaultState;
      const nextState = currentState;
      const nextStateAge = (enemy.ambientStateAge ?? 0) + 1;

      // Update ambient state age
      let updatedEnemy = {
        ...enemy,
        ambientState: nextState as AmbientState,
        ambientStateAge: nextStateAge,
      };

      // For pre-sim, just update state age and position slightly randomly
      // In a full simulation, we'd call decideAmbientAction, but that requires GameState
      // For now, this ensures enemies have varied state ages and positioning
      if (rng.next() < 0.2) {
        // 20% chance to stay, 80% to potentially move
        const neighbors = getNeighbors(updatedEnemy.position)
          .filter(position => walkablePositions.has(posKey(position)));
        if (neighbors.length > 0) {
          const randomNeighbor = neighbors[Math.floor(rng.next() * neighbors.length)]!;
          updatedEnemy = { ...updatedEnemy, position: randomNeighbor };
        }
      }

      const newPosition = pickUnoccupiedPreSimPosition(enemy.position, updatedEnemy.position, occupied, walkablePositions);
      const newKey = posKey(newPosition);
      updatedEnemy = newPosition === updatedEnemy.position
        ? updatedEnemy
        : { ...updatedEnemy, position: newPosition };
      newEnemies.set(newKey, updatedEnemy);
      occupied.add(newKey);
    }

    simEnemies = newEnemies;
  }

  return simEnemies;
}

function pickUnoccupiedPreSimPosition(
  currentPosition: Position,
  desiredPosition: Position,
  occupied: ReadonlySet<string>,
  walkablePositions: ReadonlySet<string>,
): Position {
  const candidates = [desiredPosition, currentPosition, ...getNeighbors(currentPosition)];
  for (const candidate of candidates) {
    const candidateKey = posKey(candidate);
    if (walkablePositions.has(candidateKey) !== true) {
      continue;
    }
    if (occupied.has(candidateKey) === false) {
      return candidate;
    }
  }

  return currentPosition;
}
