import type { GameState, Direction, DomainEvent, EntityId } from '@dungeon/contracts';
import { OBJECT_TEMPLATES } from '@dungeon/content';
import { entityId } from '@dungeon/contracts';
import type { CommandResult } from './shared.js';
import { updateRunMetrics, updateFloorCacheForCurrentFloor } from './shared.js';
import { addItemToInventory } from '../../systems/inventory.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';
import type { SeededRNG } from '../../utils/rng.js';
import { validateDisarmTrapAction } from '../../systems/trap-action-validator.js';
import { rejectPlayerAction } from '../action-rejection.js';

/**
 * Handle DISARM_TRAP command.
 * Validates adjacent tile has a disarmable trap, removes it, and adds it to inventory.
 * Emits TRAP_DISARMED on success or PLAYER_ACTION_REJECTED on failure.
 */
export function handleDisarmTrap(
  state: GameState,
  direction: Direction,
  rng: SeededRNG,
): CommandResult {
  // Validate the disarm action using centralized validator
  const validation = validateDisarmTrapAction(state, direction);

  if (validation.valid === false) {
    // Rejected disarm: emit PLAYER_ACTION_REJECTED and return unchanged state
    return rejectPlayerAction(
      state,
      'DISARM_TRAP',
      'DISARM_TRAP',
      validation.rejectionCode,
      validation.message,
      state.player.id,
    );
  }

  // Successful disarm: mutation phase
  let events: DomainEvent[] = [];

  const run = state.run!; // Validation already checked this exists

  // Remove trap from floor
  const newObjects = new Map(run.objects);
  newObjects.delete(validation.objectKey);

  // Add trap item to inventory
  const inventoryResult = addItemToInventory(state, validation.recoveredItemTemplate);

  // Update state
  let newState: GameState = {
    ...inventoryResult.state,
    run: {
      ...run,
      objects: newObjects,
      turnCount: run.turnCount + 1,
    },
    turnNumber: state.turnNumber + 1,
  };

  // Emit TRAP_DISARMED event
  const trapTemplate = OBJECT_TEMPLATES.get(validation.trapObject.templateId);
  const trapName = trapTemplate?.name ?? 'trap';

  // Extract the item ID from the LOOT_ACQUIRED event
  const lootEvent = inventoryResult.events.find(
    (e): e is Extract<typeof inventoryResult.events[0], { type: 'LOOT_ACQUIRED' }> => e.type === 'LOOT_ACQUIRED'
  );
  const recoveredItemId: EntityId = lootEvent?.itemId ?? entityId('unknown');

  events = [
    {
      type: 'TRAP_DISARMED',
      timestamp: newState.turnNumber,
      turnNumber: newState.turnNumber,
      trapObjectId: validation.trapObject.id as EntityId,
      trapName,
      position: validation.adjacentPos,
      recoveredItemId,
      recoveredItemName: validation.recoveredItemTemplate.name,
      playerId: state.player.id,
    },
    ...inventoryResult.events,
  ];

  // Tick ability cooldowns (consumes action)
  newState = tickAbilityCooldowns(newState);

  // Update metrics
  newState = updateRunMetrics(newState, { turnsElapsed: 1 });

  // Update cache to persist modified floor state
  newState = updateFloorCacheForCurrentFloor(newState);

  // Process enemy turns with player speed for speed-based action accumulation
  const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
  newState = enemyResult.state;
  events = [...events, ...enemyResult.events];

  return { state: newState, events, runEnded: false };
}
