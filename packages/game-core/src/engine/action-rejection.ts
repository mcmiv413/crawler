import type { GameState, EntityId, Position } from '@dungeon/contracts';
import type { CommandResult } from './handlers/shared.js';

/**
 * Rejects a player action, emitting a typed rejection event and returning unchanged state.
 *
 * This helper ensures that:
 * - State is never mutated
 * - Resources are never consumed
 * - Exactly one PLAYER_ACTION_REJECTED event is emitted
 * - The rejection includes a stable reason code and player-readable message
 *
 * @param state The current game state (unchanged in result)
 * @param actionType The category of action (e.g., 'ABILITY', 'ITEM', 'INTERACT')
 * @param actionId A unique identifier for the specific action
 * @param reasonCode A stable, machine-readable code for the rejection reason
 * @param message A player-readable explanation of why the action was rejected
 * @param playerId The ID of the player attempting the action
 * @param options Optional context fields for the rejection event
 * @returns A command result with unchanged state and one rejection event
 */
export function rejectPlayerAction(
  state: GameState,
  actionType: string,
  actionId: string,
  reasonCode: string,
  message: string,
  playerId: EntityId,
  options?: {
    readonly targetId?: EntityId;
    readonly targetPosition?: Position;
    readonly itemId?: string;
    readonly abilityId?: string;
    readonly source?: string;
  },
): CommandResult {
  const turnNumber = state.turnNumber;
  const timestamp = state.turnNumber;

  return {
    state,
    events: [
      {
        type: 'PLAYER_ACTION_REJECTED',
        timestamp,
        turnNumber,
        actionType,
        actionId,
        reasonCode,
        message,
        playerId,
        targetId: options?.targetId,
        targetPosition: options?.targetPosition,
        itemId: options?.itemId,
        abilityId: options?.abilityId,
        source: options?.source,
      },
    ],
    runEnded: false,
  };
}
