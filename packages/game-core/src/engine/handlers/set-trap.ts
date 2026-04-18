import type { GameState, Direction, EntityId, ObjectInstance } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { OBJECT_TEMPLATES } from '@dungeon/content';
import type { CommandResult } from './shared.js';
import { updateRunMetrics, updateFloorCacheForCurrentFloor } from './shared.js';
import { moveInDirection } from '../../utils/grid.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';
import { generateId } from '../../utils/id.js';
import { entityId } from '@dungeon/contracts';
import type { SeededRNG } from '../../utils/rng.js';
import type { TrapItemTemplate } from '@dungeon/contracts';

/**
 * Handle SET_TRAP command.
 * Validates adjacent tile is empty, removes trap item from inventory, and places trap on floor.
 */
export function handleSetTrap(
  state: GameState,
  direction: Direction,
  itemEntityId: EntityId,
  rng: SeededRNG,
): CommandResult {
  if (state.run === null || state.phase !== 'dungeon') {
    return { state, events: [], runEnded: false };
  }

  try {
    // Check inventory contains the trap item
    if (!state.player.inventory.includes(itemEntityId)) {
      return { state, events: [], runEnded: false };
    }

    // Look up the trap item in registry
    const trapItem = state.itemRegistry.items.get(itemEntityId);
    if (trapItem === undefined || trapItem.itemClass !== 'trap') {
      return { state, events: [], runEnded: false };
    }

    const trapItemTemplate = trapItem as TrapItemTemplate;
    const hazardTemplate = OBJECT_TEMPLATES.get(trapItemTemplate.trapTemplateId);
    if (hazardTemplate === undefined) {
      return { state, events: [], runEnded: false };
    }

    // Get adjacent position
    const adjacentPos = moveInDirection(state.player.position, direction);
    const objKey = posKey(adjacentPos);

    // Validate adjacent tile is empty and walkable
    if (state.run.objects.has(objKey)) {
      return { state, events: [], runEnded: false };
    }

    // Validate not blocked by enemy
    for (const enemy of state.run.enemies.values()) {
      if (enemy.position.x === adjacentPos.x && enemy.position.y === adjacentPos.y) {
        return { state, events: [], runEnded: false };
      }
    }

    // Create trap instance on floor
    const trapInstance: ObjectInstance = {
      id: entityId(generateId()),
      templateId: trapItemTemplate.trapTemplateId,
      position: adjacentPos,
      isExhausted: false,
    };

    // Remove trap item from inventory
    const newInventory = state.player.inventory.filter(id => id !== itemEntityId);

    // Add trap to floor
    const newObjects = new Map(state.run.objects);
    newObjects.set(objKey, trapInstance);

    // Update state
    let newState: GameState = {
      ...state,
      player: {
        ...state.player,
        inventory: newInventory,
      },
      run: {
        ...state.run,
        objects: newObjects,
        turnCount: state.run.turnCount + 1,
      },
      turnNumber: state.turnNumber + 1,
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

    const events = enemyResult.events;

    return { state: newState, events, runEnded: false };
  } catch {
    return { state, events: [], runEnded: false };
  }
}
