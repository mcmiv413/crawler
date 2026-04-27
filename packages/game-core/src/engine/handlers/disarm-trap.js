import { posKey } from '@dungeon/contracts';
import { OBJECT_TEMPLATES, ITEM_BY_ID, woodenSpikeTrap, ironSpikeTrap, steelSpikeTrap, fireTrap, infernoTrap, blazingTrap, poisonGasTrap, toxicTrap, lethalPoisonTrap, frostTrapItem as frostTrap, frozenTrap, absoluteZeroTrap, lightningTrapItem as lightningTrap, thunderTrap } from '@dungeon/content';
import { updateRunMetrics, updateFloorCacheForCurrentFloor } from './shared.js';
import { addItemToInventory } from '../../systems/inventory.js';
import { moveInDirection } from '../../utils/grid.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';
/**
 * Handle DISARM_TRAP command.
 * Validates adjacent tile has a disarmable trap, removes it, and adds it to inventory.
 */
export function handleDisarmTrap(state, direction, rng) {
    if (state.run === null || state.phase !== 'dungeon') {
        return { state, events: [], runEnded: false };
    }
    let events = [];
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
        if (template === undefined ||
            template.isHazard !== true ||
            !isDisarmableTrapType(template.hazardType ?? '')) {
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
        let newState = {
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
        // Update cache to persist modified floor state
        newState = updateFloorCacheForCurrentFloor(newState);
        // Process enemy turns with player speed for speed-based action accumulation
        const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
        newState = enemyResult.state;
        events = [...events, ...enemyResult.events];
        return { state: newState, events, runEnded: false };
    }
    catch {
        return { state, events: [], runEnded: false };
    }
}
/**
 * Check if a hazard type is disarmable.
 */
function isDisarmableTrapType(hazardType) {
    return ['spike', 'fire', 'poison', 'frost', 'lightning'].includes(hazardType);
}
/**
 * Find a trap item that matches the given hazard type and rarity.
 */
function findTrapItemForHazard(hazardType, rarity) {
    const trapMap = {
        spike: {
            common: woodenSpikeTrap.itemId,
            uncommon: ironSpikeTrap.itemId,
            rare: steelSpikeTrap.itemId,
            epic: steelSpikeTrap.itemId,
        },
        fire: {
            common: fireTrap.itemId,
            uncommon: infernoTrap.itemId,
            rare: blazingTrap.itemId,
            epic: blazingTrap.itemId,
        },
        poison: {
            uncommon: poisonGasTrap.itemId,
            rare: toxicTrap.itemId,
            epic: lethalPoisonTrap.itemId,
        },
        frost: {
            uncommon: frostTrap.itemId,
            rare: frozenTrap.itemId,
            epic: absoluteZeroTrap.itemId,
        },
        lightning: {
            rare: lightningTrap.itemId,
            epic: thunderTrap.itemId,
        },
    };
    const trapItems = trapMap[hazardType];
    if (trapItems === undefined)
        return null;
    // Try exact match first, then fallback to epic variant
    return trapItems[rarity] ?? trapItems.epic ?? null;
}
//# sourceMappingURL=disarm-trap.js.map