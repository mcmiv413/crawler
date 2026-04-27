import { posKey } from '@dungeon/contracts';
import { ITEM_BY_ID, OBJECT_TEMPLATES } from '@dungeon/content';
import { updateRunMetrics } from './shared.js';
import { validateMove } from '../../systems/movement.js';
import { computeFov } from '../../systems/fov.js';
import { moveInDirection } from '../../utils/grid.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';
import { rollChestLoot, rollRareLoot } from '../../systems/loot.js';
import { addItemToInventory } from '../../systems/inventory.js';
import { handleAttack } from './combat.js';
import { handlePlayerDeath } from '../../systems/death.js';
import { calculateHazardDamage, hazardTypeToDamageType } from '../../systems/hazard-damage.js';
import { applyDamageToPlayer } from '../../systems/damage.js';
export function handleMove(state, direction, rng) {
    const validation = validateMove(state, direction);
    if (!validation.valid || !validation.newPosition) {
        // Bump-to-attack: if blocked by enemy, attack that enemy
        if (validation.reason === 'Tile occupied by enemy' && state.run) {
            try {
                const targetPos = moveInDirection(state.player.position, direction);
                for (const enemy of state.run.enemies.values()) {
                    if (enemy.position.x === targetPos.x && enemy.position.y === targetPos.y) {
                        return handleAttack(state, enemy.id, rng);
                    }
                }
            }
            catch {
                // If moveInDirection fails (invalid direction), just return empty result
                return { state, events: [], runEnded: false };
            }
        }
        return { state, events: [], runEnded: false };
    }
    const newPos = validation.newPosition;
    let events = [];
    events = [...events, {
            type: 'PLAYER_MOVED',
            from: state.player.position,
            to: newPos,
            timestamp: Date.now(),
            turnNumber: state.turnNumber,
        }];
    let newState = {
        ...state,
        player: { ...state.player, position: newPos },
        turnNumber: state.turnNumber + 1,
    };
    // Check for hazardous objects (traps) at the new position
    if (newState.run !== null) {
        const objKey = posKey(newPos);
        const objAtPos = newState.run.objects.get(objKey);
        if (objAtPos !== undefined) {
            const template = OBJECT_TEMPLATES.get(objAtPos.templateId);
            if (template !== undefined && template.isHazard === true) {
                // Trap triggered - calculate damage and route through central damage function
                const trapDamage = calculateHazardDamage(template, newState.player.stats.maxHealth);
                const damageType = template.hazardType !== undefined ? hazardTypeToDamageType(template.hazardType) : 'physical';
                // Apply damage through central function (applies defense and resistance)
                const damageResult = applyDamageToPlayer(newState, {
                    amount: trapDamage,
                    damageType,
                    source: 'trap',
                    sourceId: objAtPos.id,
                });
                newState = damageResult.state;
                // Emit trap triggered event with enriched data
                events = [...events, {
                        type: 'TRAP_TRIGGERED',
                        trapId: objAtPos.id,
                        trapName: template.name,
                        position: newPos,
                        damage: damageResult.finalDamage,
                        rarity: template.rarity,
                        hazardType: template.hazardType,
                        statusEffect: template.statusEffect,
                        timestamp: Date.now(),
                        turnNumber: state.turnNumber,
                    }];
                // Check if trap damage is lethal
                if (damageResult.killed === true) {
                    const deathResult = handlePlayerDeath(newState, {
                        type: 'TRAP_HAZARD',
                        hazardId: objAtPos.id,
                        hazardName: template.name,
                        damage: damageResult.finalDamage,
                    });
                    newState = deathResult.state;
                    events = [...events, ...deathResult.events];
                    return { state: newState, events, runEnded: true };
                }
            }
        }
    }
    // Track turn elapsed
    newState = updateRunMetrics(newState, { turnsElapsed: 1 });
    // Recompute FOV after movement
    if (newState.run !== null) {
        const updatedCells = computeFov(newState.run.floor, newPos);
        const updatedFloor = { ...newState.run.floor, cells: updatedCells };
        newState = {
            ...newState,
            run: { ...newState.run, floor: updatedFloor },
        };
    }
    // Process enemy turns with player speed for kiting system, then tick ability cooldowns
    const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
    newState = enemyResult.state;
    events = [...events, ...enemyResult.events];
    newState = tickAbilityCooldowns(newState);
    const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
    return { state: newState, events, runEnded };
}
export function handleWait(state, rng) {
    let newState = { ...state, turnNumber: state.turnNumber + 1 };
    let events = [];
    newState = updateRunMetrics(newState, { turnsElapsed: 1 });
    const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
    newState = enemyResult.state;
    events = [...events, ...enemyResult.events];
    newState = tickAbilityCooldowns(newState);
    const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
    return { state: newState, events, runEnded };
}
export function handleInteract(state, targetPosition, rng) {
    if (state.run === null)
        return { state, events: [], runEnded: false };
    const key = posKey(targetPosition);
    const obj = state.run.objects.get(key);
    if (obj === undefined)
        return { state, events: [], runEnded: false };
    const template = OBJECT_TEMPLATES.get(obj.templateId);
    if (template === undefined)
        return { state, events: [], runEnded: false };
    let newState = state;
    let events = [];
    let gotLoot = false;
    // Apply health delta if any (percentage-based takes precedence over fixed)
    if (template.healthDeltaPercent !== undefined && template.healthDeltaPercent !== 0) {
        const healthBefore = newState.player.stats.health;
        const percentChange = Math.round(newState.player.stats.maxHealth * (template.healthDeltaPercent / 100));
        const newHealth = Math.max(0, Math.min(newState.player.stats.maxHealth, healthBefore + percentChange));
        newState = {
            ...newState,
            player: {
                ...newState.player,
                stats: {
                    ...newState.player.stats,
                    health: newHealth,
                },
            },
        };
    }
    else if (template.healthDelta !== 0) {
        const healthBefore = newState.player.stats.health;
        const newHealth = Math.max(0, healthBefore + template.healthDelta);
        newState = {
            ...newState,
            player: {
                ...newState.player,
                stats: {
                    ...newState.player.stats,
                    health: newHealth,
                },
            },
        };
    }
    // Handle gold pickup with depth scaling
    if (template.goldDeltaMin !== undefined && template.goldDeltaMax !== undefined) {
        const baseGold = rng.int(template.goldDeltaMin, template.goldDeltaMax);
        const depth = newState.run.floor.depth;
        const scaledGold = Math.floor(baseGold * depth / 2);
        const goldBefore = newState.player.gold;
        const goldAfter = goldBefore + scaledGold;
        newState = {
            ...newState,
            player: {
                ...newState.player,
                gold: goldAfter,
            },
        };
        events = [...events, {
                type: 'GOLD_CHANGED',
                playerId: newState.player.id,
                amount: scaledGold,
                newTotal: goldAfter,
                reason: template.name,
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            }];
    }
    // Roll loot if object has lootTableId
    if (template.lootTableId !== undefined && template.lootTableId !== '') {
        const lootItemId = template.lootTableId === 'loot_rare'
            ? rollRareLoot(rng)
            : rollChestLoot(newState.run.floor.depth, rng);
        if (lootItemId !== null) {
            const itemTemplate = ITEM_BY_ID.get(lootItemId);
            if (itemTemplate !== undefined) {
                const inventoryResult = addItemToInventory(newState, itemTemplate);
                newState = inventoryResult.state;
                events = [...events, ...inventoryResult.events];
                gotLoot = true;
            }
        }
    }
    // Emit object interacted event
    events = [...events, {
            type: 'OBJECT_INTERACTED',
            objectId: obj.id,
            objectName: template.name,
            position: targetPosition,
            healthDelta: template.healthDelta,
            gotLoot,
            timestamp: Date.now(),
            turnNumber: state.turnNumber,
        }];
    // Increment turn
    newState = { ...newState, turnNumber: newState.turnNumber + 1 };
    newState = updateRunMetrics(newState, { turnsElapsed: 1 });
    // Remove object from map if consumable
    if (template.consumable === true) {
        const newObjects = new Map(newState.run.objects);
        newObjects.delete(key);
        newState = {
            ...newState,
            run: { ...newState.run, objects: newObjects },
        };
    }
    // Process enemy turns with player speed for kiting system and tick cooldowns
    const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
    newState = enemyResult.state;
    events = [...events, ...enemyResult.events];
    newState = tickAbilityCooldowns(newState);
    const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
    return { state: newState, events, runEnded };
}
//# sourceMappingURL=movement.js.map