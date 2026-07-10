import type { GameState, Direction, EntityId, ObjectInstance } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import type { CommandResult } from './shared.js';
import { updateRunMetrics, updateFloorCacheForCurrentFloor } from './shared.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';
import { generateId } from '../../utils/id.js';
import type { SeededRNG } from '../../utils/rng.js';
import { validateSetTrapAction } from '../../systems/trap-action-validator.js';
import { rejectPlayerAction } from '../action-rejection.js';

/**
 * Handle SET_TRAP command.
 * Validates adjacent tile is empty, removes trap item from inventory, and places trap on floor.
 * Emits TRAP_PLACED on success or PLAYER_ACTION_REJECTED on failure.
 */
export function handleSetTrap(
  state: GameState,
  direction: Direction,
  itemEntityId: EntityId,
  rng: SeededRNG,
): CommandResult {
  // Validate the set trap action using centralized validator
  const validation = validateSetTrapAction(state, direction, itemEntityId);

  if (validation.valid === false) {
    // Rejected placement: emit PLAYER_ACTION_REJECTED and return unchanged state
    return rejectPlayerAction(
      state,
      'SET_TRAP',
      'SET_TRAP',
      validation.rejectionCode,
      validation.message,
      state.player.id,
    );
  }

  // Successful placement: mutation phase
  const run = state.run!; // Validation already checked this exists

  // Create trap instance on floor
  const trapInstance: ObjectInstance = {
    id: entityId(generateId()),
    templateId: validation.trapItemTemplate.trapTemplateId,
    position: validation.adjacentPos,
    isExhausted: false,
    origin: 'player',
  };

  // Remove trap item from inventory
  const newInventory = state.player.inventory.filter(id => id !== itemEntityId);

  // Add trap to floor
  const newObjects = new Map(run.objects);
  newObjects.set(validation.objectKey, trapInstance);

  // Update state
  let newState: GameState = {
    ...state,
    player: {
      ...state.player,
      inventory: newInventory,
    },
    run: {
      ...run,
      objects: newObjects,
      turnCount: run.turnCount + 1,
    },
    turnNumber: state.turnNumber + 1,
  };

  // Emit TRAP_PLACED event
  const trapPlacedEvent = {
    type: 'TRAP_PLACED' as const,
    timestamp: newState.turnNumber,
    turnNumber: newState.turnNumber,
    trapObjectId: trapInstance.id,
    trapName: validation.hazardTemplate.name || 'trap',
    trapTemplateId: validation.trapItemTemplate.trapTemplateId,
    itemEntityId,
    position: validation.adjacentPos,
    playerId: state.player.id,
  };

  // Tick ability cooldowns
  newState = tickAbilityCooldowns(newState);

  // Update metrics
  newState = updateRunMetrics(newState, { turnsElapsed: 1 });

  // Update cache to persist modified floor state
  newState = updateFloorCacheForCurrentFloor(newState);

  // Process enemy turns with player speed for speed-based action accumulation
  const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
  newState = enemyResult.state;

  const events = [trapPlacedEvent, ...enemyResult.events];

  return { state: newState, events, runEnded: false };
}
