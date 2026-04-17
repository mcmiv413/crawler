import type { GameState, Direction, DomainEvent } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { OBJECT_TEMPLATES, ITEM_BY_ID } from '@dungeon/content';
import type { CommandResult } from './shared.js';
import { updateRunMetrics } from './shared.js';
import { addItemToInventory } from '../../systems/inventory.js';
import { moveInDirection } from '../../utils/grid.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';
import type { SeededRNG } from '../../utils/rng.js';

/**
 * Handle DISARM_TRAP command.
 * Validates adjacent tile has a disarmable trap, removes it, and adds it to inventory.
 */
export function handleDisarmTrap(
  state: GameState,
  direction: Direction,
  rng: SeededRNG,
): CommandResult {
  if (state.run === null || state.phase !== 'dungeon') {
    return { state, events: [], runEnded: false };
  }

  let events: DomainEvent[] = [];

  try {
    // Get adjacent position
    const adjacentPos = moveInDirection(state.player.position, direction);
    const objKey = posKey(adjacentPos);
    const objAtPos = state.run.objects.get(objKey);

    // Validate trap exists
    if (objAtPos === undefined) {
      return { state, events: [], runEnded: false };
    }

    const template = OBJECT_TEMPLATES.get(objAtPos.templateId);
    if (
      template === undefined ||
      template.isHazard !== true ||
      !['spike', 'fire'].includes(template.hazardType ?? '')
    ) {
      return { state, events: [], runEnded: false };
    }

    // Find matching trap item based on hazard type and rarity
    const trapItemId = findTrapItemForHazard(template.hazardType === undefined ? '' : template.hazardType, template.rarity ?? 'common');
    if (trapItemId === null) {
      return { state, events: [], runEnded: false };
    }

    const trapTemplate = ITEM_BY_ID.get(trapItemId);
    if (trapTemplate === undefined) {
      return { state, events: [], runEnded: false };
    }

    // Remove trap from floor
    const newObjects = new Map(state.run.objects);
    newObjects.delete(objKey);

    // Add trap item to inventory
    const inventoryResult = addItemToInventory(state, trapTemplate);

    // Update state
    let newState: GameState = {
      ...inventoryResult.state,
      run: {
        ...state.run,
        objects: newObjects,
        turnCount: state.run.turnCount + 1,
      },
      turnNumber: state.turnNumber + 1,
    };

    // Gather events (inventory events + any new events)
    events = [...events, ...inventoryResult.events];

    // Tick ability cooldowns (consumes action)
    newState = tickAbilityCooldowns(newState);

    // Update metrics
    newState = updateRunMetrics(newState, { turnsElapsed: 1 });

    // Process enemy turns
    const enemyResult = processEnemyTurns(newState, rng);
    newState = enemyResult.state;
    events = [...events, ...enemyResult.events];

    return { state: newState, events, runEnded: false };
  } catch {
    return { state, events: [], runEnded: false };
  }
}

/**
 * Find a trap item that matches the given hazard type and rarity.
 */
function findTrapItemForHazard(hazardType: string, rarity: string): string | null {
  const trapMap: Record<string, Record<string, string>> = {
    spike: {
      common: 'wooden_spike_trap',
      uncommon: 'iron_spike_trap',
      rare: 'steel_spike_trap',
      epic: 'steel_spike_trap',
    },
    fire: {
      common: 'fire_trap',
      uncommon: 'inferno_trap',
      rare: 'blazing_trap',
      epic: 'blazing_trap',
    },
    poison: {
      uncommon: 'poison_gas_trap',
      rare: 'toxic_trap',
      epic: 'lethal_poison_trap',
    },
    frost: {
      uncommon: 'frost_trap',
      rare: 'frozen_trap',
      epic: 'absolute_zero_trap',
    },
    lightning: {
      rare: 'lightning_trap',
      epic: 'thunder_trap',
    },
  };

  const trapItems = trapMap[hazardType];
  if (trapItems === undefined) return null;

  // Try exact match first, then fallback to epic variant
  return trapItems[rarity] ?? trapItems.epic ?? null;
}
