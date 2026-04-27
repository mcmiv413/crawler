import { ECONOMY, ITEM_BY_ID, ALL_ITEMS, getDropWeights } from '@dungeon/content';
import { addItemToInventory } from './inventory.js';
import { entityId } from '@dungeon/contracts';
import { generateId } from '../utils/id.js';
/** Pick a rarity based on weighted [common, uncommon, rare, epic] */
function weightedPickRarity(weights, rng) {
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng.float(0, total);
    const rarities = ['common', 'uncommon', 'rare', 'epic'];
    for (let i = 0; i < weights.length; i++) {
        roll -= weights[i];
        if (roll <= 0)
            return rarities[i];
    }
    return 'common';
}
/** Roll for item loot from a chest at the given depth */
export function rollChestLoot(depth, rng) {
    const weights = getDropWeights(depth);
    const rarity = weightedPickRarity(weights, rng);
    const eligible = ALL_ITEMS.filter(item => item.rarity === rarity && item.itemClass !== 'trap');
    if (eligible.length === 0) {
        // Fallback to any item if no eligible at this rarity
        const fallback = ALL_ITEMS.filter(item => item.rarity === 'common' && item.itemClass !== 'trap');
        if (fallback.length === 0)
            return null;
        const weighted = fallback.flatMap(item => item.itemClass === 'consumable' ? [item] : [item, item]);
        return rng.pick(weighted).itemId;
    }
    const weighted = eligible.flatMap(item => item.itemClass === 'consumable' ? [item] : [item, item]);
    return rng.pick(weighted).itemId;
}
/** Roll for rare or better loot (used by special objects like arcane altar) */
export function rollRareLoot(rng) {
    const eligible = ALL_ITEMS.filter(item => (item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary') &&
        item.itemClass !== 'trap');
    if (eligible.length === 0)
        return null;
    const weighted = eligible.flatMap(item => item.itemClass === 'consumable' ? [item] : [item, item]);
    return rng.pick(weighted).itemId;
}
/** Generate gold drop for a killed enemy (optional nemesis multiplier) */
export function rollGoldDrop(enemy, rng, nemesisRank) {
    const tierGold = ECONOMY.goldPerTier[enemy.tier];
    const variance = rng.float(0.7, 1.3);
    let baseGold = Math.round(tierGold * variance);
    // Apply nemesis multiplier: rank 1 = 3×, rank 2 = 5×, rank 3 = 8×
    if (nemesisRank !== undefined && nemesisRank >= 1 && nemesisRank <= 3) {
        const multipliers = [1, 3, 5, 8];
        baseGold = Math.round(baseGold * multipliers[nemesisRank]);
    }
    return baseGold;
}
/** Roll for item drop from enemy (optional nemesis rank for guaranteed drop + rarity boost) */
export function rollItemDrop(_enemy, rng, depth = 1, nemesisRank) {
    // Nemesis guarantees 100% drop; normal enemies have 30% chance
    if (nemesisRank === undefined && !rng.chance(30))
        return null;
    const weights = getDropWeights(depth);
    // Shift rarity weights up for nemesis (uncommon minimum for rank 1+, rare minimum for rank 2+)
    let adjustedWeights = weights;
    if (nemesisRank === 1) {
        // Shift weights: reduce common, boost uncommon/rare
        adjustedWeights = [Math.max(0, weights[0] - 20), weights[1] + 15, weights[2] + 5, weights[3]];
    }
    else if (nemesisRank === 2) {
        // Shift weights more: reduce common/uncommon, boost rare/epic
        adjustedWeights = [Math.max(0, weights[0] - 30), Math.max(0, weights[1] - 15), weights[2] + 30, weights[3] + 15];
    }
    else if (nemesisRank === 3) {
        // Shift weights even more: rare minimum
        adjustedWeights = [0, 0, weights[2] + 40, weights[3] + 40];
    }
    const rarity = weightedPickRarity(adjustedWeights, rng);
    const eligible = ALL_ITEMS.filter(item => item.rarity === rarity && item.itemClass !== 'trap');
    if (eligible.length === 0) {
        const fallback = ALL_ITEMS.filter(item => item.rarity === 'common' && item.itemClass !== 'trap');
        if (fallback.length === 0)
            return null;
        const weighted = fallback.flatMap(item => item.itemClass === 'consumable' ? [item] : [item, item]);
        return rng.pick(weighted).itemId;
    }
    const weighted = eligible.flatMap(item => item.itemClass === 'consumable' ? [item] : [item, item]);
    return rng.pick(weighted).itemId;
}
/** Process loot from a killed enemy (optional nemesis rank for enhanced loot) */
export function processEnemyLoot(state, enemy, rng, nemesisRank) {
    let events = [];
    let currentState = state;
    // Gold drop (with optional nemesis multiplier)
    const gold = rollGoldDrop(enemy, rng, nemesisRank);
    if (gold > 0) {
        currentState = {
            ...currentState,
            player: {
                ...currentState.player,
                gold: currentState.player.gold + gold,
            },
        };
        events = [...events, {
                type: 'GOLD_CHANGED',
                playerId: currentState.player.id,
                amount: gold,
                newTotal: currentState.player.gold,
                reason: `Looted from ${enemy.name}`,
                timestamp: Date.now(),
                turnNumber: currentState.turnNumber,
            }];
    }
    // Item drop (with optional nemesis boost)
    const depth = state.run?.floor.depth ?? 1;
    const itemId = rollItemDrop(enemy, rng, depth, nemesisRank);
    if (itemId !== null) {
        const template = ITEM_BY_ID.get(itemId);
        if (template !== undefined) {
            // C1: Unlimited inventory — always add items
            const result = addItemToInventory(currentState, template);
            currentState = result.state;
            events = [...events, ...result.events];
        }
    }
    return { state: currentState, events };
}
/** Create a unique nemesis loot item template */
export function rollNemesisLoot(aiLootData, nemesisRank, nemesisTier, floor, weaponType) {
    // Determine rarity based on tier and rank
    let rarity;
    if (nemesisTier >= 4 && nemesisRank === 3) {
        rarity = 'legendary';
    }
    else if (nemesisRank === 3 || (nemesisTier >= 3 && nemesisRank >= 2)) {
        rarity = 'epic';
    }
    else if (nemesisTier >= 2 || nemesisRank >= 2) {
        rarity = 'rare';
    }
    else {
        rarity = 'uncommon';
    }
    // Determine item class: weapon if killed by weapon type, else armor
    const itemClass = weaponType !== null ? 'weapon' : 'armor';
    // Base value scales with tier and floor
    const baseValue = Math.max(100, 50 * nemesisTier + 20 * Math.floor(floor / 5));
    // Nemesis loot value has inherent variance (server-side generation, not game-critical)
    const variance = 0.9 + (Math.abs(Math.sin(nemesisTier * floor)) % 0.2);
    const value = Math.round(baseValue * variance);
    const itemId = entityId(generateId());
    if (itemClass === 'weapon') {
        // Create a weapon template
        return {
            itemId,
            name: aiLootData.name,
            description: aiLootData.description,
            itemClass: 'weapon',
            rarity,
            value,
            stackable: false,
            maxStack: 1,
            weapon: {
                damage: Math.round(8 + nemesisTier * 4 + nemesisRank),
                damageType: 'physical',
                accuracy: 75 + nemesisTier * 3,
                speed: 5,
                slot: 'weapon',
                weaponRange: 1,
                weaponType: (weaponType ?? 'blade'),
            },
        };
    }
    else {
        // Create an armor template
        return {
            itemId,
            name: aiLootData.name,
            description: aiLootData.description,
            itemClass: 'armor',
            rarity,
            value,
            stackable: false,
            maxStack: 1,
            armor: {
                defense: Math.round(4 + nemesisTier * 3 + nemesisRank),
                evasionPenalty: 0,
                slot: 'chest',
                enchantmentSlots: nemesisRank >= 2 ? 2 : 1,
                enchantments: [],
            },
        };
    }
}
//# sourceMappingURL=loot.js.map