import type { GameState, Direction, MovementBlockedEvent, MovementBlockedReasonCode } from '@dungeon/contracts';
import { moveInDirection } from '../../utils/grid.js';
import type { MoveValidation } from '../../systems/movement.js';
import {
  INVALID_DIRECTION,
  NOT_IN_DUNGEON,
  OUT_OF_BOUNDS,
  NOT_WALKABLE,
  TARGET_NOT_FOUND,
} from '../rejection-codes.js';

/**
 * Centralized mapping from a {@link MoveValidation} reason string to a stable
 * movement-blocked reason code and a player-readable message.
 *
 * This keeps the fragile validation-reason strings in a single place so handlers
 * never hardcode freeform messages per branch.
 */
interface MovementBlockedMapping {
  readonly reasonCode: MovementBlockedReasonCode;
  readonly message: string;
}

const MOVEMENT_BLOCKED_MAPPINGS: Record<string, MovementBlockedMapping> = {
  'Invalid direction': { reasonCode: INVALID_DIRECTION, message: 'You cannot move that way.' },
  'Not in a dungeon run': { reasonCode: NOT_IN_DUNGEON, message: 'You cannot move right now.' },
  'Out of bounds': { reasonCode: OUT_OF_BOUNDS, message: 'You cannot move outside the map.' },
  'Tile is not walkable': { reasonCode: NOT_WALKABLE, message: 'That way is blocked.' },
};

const FALLBACK_MAPPING: MovementBlockedMapping = {
  reasonCode: NOT_WALKABLE,
  message: 'You cannot move there.',
};

const TARGET_NOT_FOUND_MAPPING: MovementBlockedMapping = {
  reasonCode: TARGET_NOT_FOUND,
  message: 'There is nothing there to attack.',
};

/**
 * Resolve the position the player attempted to move to for a given direction.
 * Falls back to the player's current position if the direction is unrecognized
 * (which would have already caused an INVALID_DIRECTION validation failure).
 */
function resolveAttemptedPosition(state: GameState, direction: Direction): { x: number; y: number } {
  try {
    return moveInDirection(state.player.position, direction);
  } catch {
    return state.player.position;
  }
}

/**
 * Build a MOVEMENT_BLOCKED event from a failed move validation result.
 *
 * Pure: does not mutate state. The handler is responsible for returning unchanged
 * state alongside this event and for not advancing the turn.
 *
 * @param state Current game state (unchanged)
 * @param direction The direction the player attempted to move
 * @param validation The failed {@link MoveValidation} result from validateMove
 */
export function buildMovementBlockedEvent(
  state: GameState,
  direction: Direction,
  validation: MoveValidation,
): MovementBlockedEvent {
  const reason = validation.reason;
  const mapping = (reason !== undefined ? MOVEMENT_BLOCKED_MAPPINGS[reason] : undefined) ?? FALLBACK_MAPPING;
  return makeMovementBlockedEvent(state, direction, mapping);
}

/**
 * Build a MOVEMENT_BLOCKED event for the case where enemy-occupied movement was
 * detected but no matching enemy could be located to attack (TARGET_NOT_FOUND).
 */
export function buildTargetNotFoundMovementBlockedEvent(
  state: GameState,
  direction: Direction,
): MovementBlockedEvent {
  return makeMovementBlockedEvent(state, direction, TARGET_NOT_FOUND_MAPPING);
}

function makeMovementBlockedEvent(
  state: GameState,
  direction: Direction,
  mapping: MovementBlockedMapping,
): MovementBlockedEvent {
  return {
    type: 'MOVEMENT_BLOCKED',
    playerId: state.player.id,
    from: state.player.position,
    attemptedTo: resolveAttemptedPosition(state, direction),
    direction,
    reasonCode: mapping.reasonCode,
    message: mapping.message,
    timestamp: state.turnNumber,
    turnNumber: state.turnNumber,
  };
}
