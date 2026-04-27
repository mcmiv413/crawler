import { entityId } from '@dungeon/contracts';
import { generateId } from '../utils/id.js';
import { applyStatusToPlayer } from './status-effects.js';
import { chebyshevDistance } from '../utils/grid.js';
import { applyDamageToEnemy } from './damage.js';
const RARITY_RANK = {
    common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4,
};
export function addItemToInventory(state, itemTemplate) {
    const itemEntityId = entityId(generateId());
    let events = [{
            type: 'LOOT_ACQUIRED',
            itemId: itemEntityId,
            itemName: itemTemplate.name,
            playerId: state.player.id,
            timestamp: Date.now(),
            turnNumber: state.turnNumber,
        }];
    // Register item in registry
    const newRegistry = new Map(state.itemRegistry.items);
    newRegistry.set(itemEntityId, itemTemplate);
    const newPlayer = {
        ...state.player,
        inventory: [...state.player.inventory, itemEntityId],
    };
    // Track highest rarity found and emit shop tier unlock events
    const currentRank = RARITY_RANK[state.world.highestRarityFound] ?? 0;
    const itemRank = RARITY_RANK[itemTemplate.rarity] ?? 0;
    let newHighestRarity = state.world.highestRarityFound;
    if (itemRank > currentRank) {
        newHighestRarity = itemTemplate.rarity;
        let tierEvents = [];
        // Finding an epic item → unlocks uncommon shop tier
        if (itemTemplate.rarity === 'epic' && currentRank < RARITY_RANK['epic']) {
            tierEvents = [...tierEvents, {
                    type: 'SHOP_TIER_UNLOCKED',
                    unlockedTier: 'uncommon',
                    triggerRarity: 'epic',
                    timestamp: Date.now(),
                    turnNumber: state.turnNumber,
                }];
        }
        // Finding a legendary item → unlocks epic shop tier
        if (itemTemplate.rarity === 'legendary' && currentRank < RARITY_RANK['legendary']) {
            tierEvents = [...tierEvents, {
                    type: 'SHOP_TIER_UNLOCKED',
                    unlockedTier: 'epic',
                    triggerRarity: 'legendary',
                    timestamp: Date.now(),
                    turnNumber: state.turnNumber,
                }];
        }
        events = [...events, ...tierEvents];
    }
    return {
        state: {
            ...state,
            player: newPlayer,
            itemRegistry: { items: newRegistry },
            world: {
                ...state.world,
                highestRarityFound: newHighestRarity,
            },
        },
        events,
    };
}
export function removeItemFromInventory(state, itemId) {
    return {
        ...state,
        player: {
            ...state.player,
            inventory: state.player.inventory.filter(id => id !== itemId),
        },
    };
}
export function useConsumable(state, itemId, targetId) {
    const template = state.itemRegistry.items.get(itemId);
    if (!template || template.itemClass !== 'consumable') {
        return { state, events: [] };
    }
    const consumable = template.consumable;
    let newPlayer = { ...state.player };
    let newState = state;
    switch (consumable.effect) {
        case 'heal': {
            const healed = Math.min(consumable.magnitude, newPlayer.stats.maxHealth - newPlayer.stats.health);
            newPlayer = {
                ...newPlayer,
                stats: {
                    ...newPlayer.stats,
                    health: newPlayer.stats.health + healed,
                },
            };
            break;
        }
        case 'cure': {
            if (consumable.targetStatus !== undefined) {
                newPlayer = {
                    ...newPlayer,
                    statuses: newPlayer.statuses.filter(s => s.id !== consumable.targetStatus),
                };
            }
            break;
        }
        case 'damage': {
            if (newState.run !== null) {
                if (targetId !== undefined) {
                    // Single-target: find the enemy by id across all positions
                    let targetKey = null;
                    for (const [key, enemy] of newState.run.enemies) {
                        if (enemy.id === targetId) {
                            targetKey = key;
                            break;
                        }
                    }
                    if (targetKey !== null) {
                        const enemy = newState.run.enemies.get(targetKey);
                        // Apply damage through central function (applies defense and resistance)
                        const damageResult = applyDamageToEnemy(newState, enemy.id, {
                            amount: consumable.magnitude,
                            damageType: 'physical',
                            source: 'consumable',
                            sourceId: itemId,
                        });
                        newState = damageResult.state;
                    }
                }
                else {
                    // AOE: apply damage to all adjacent enemies (within Chebyshev distance 1)
                    for (const [, enemy] of newState.run.enemies) {
                        const distance = chebyshevDistance(enemy.position, newState.player.position);
                        if (distance <= 1) {
                            // Apply damage through central function (applies defense and resistance)
                            const damageResult = applyDamageToEnemy(newState, enemy.id, {
                                amount: consumable.magnitude,
                                damageType: 'physical',
                                source: 'consumable',
                                sourceId: itemId,
                            });
                            newState = damageResult.state;
                        }
                    }
                }
            }
            break;
        }
        case 'buff': {
            const duration = consumable.duration ?? 10;
            // Apply status effect only; let getEffectiveStat handle the stat modification
            // (Do not directly mutate stats — status effect will provide the boost when queried)
            newPlayer = applyStatusToPlayer(newPlayer, 'strength', duration, consumable.magnitude, null);
            break;
        }
    }
    const events = [{
            type: 'ITEM_USED',
            itemId,
            itemName: template.name,
            userId: state.player.id,
            effect: consumable.effect,
            timestamp: Date.now(),
            turnNumber: state.turnNumber,
        }];
    // Remove from inventory
    return { state: removeItemFromInventory({ ...newState, player: newPlayer }, itemId), events };
}
//# sourceMappingURL=inventory.js.map