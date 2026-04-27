import { entityId } from '@dungeon/contracts';
import { NEMESIS_PROMOTION } from '@dungeon/content';
import { FALLBACK_NEMESIS_NAMES, FALLBACK_NEMESIS_TITLES } from '@dungeon/content';
import { ENCHANTMENT_BY_ID, getImpliedBlueprints } from '@dungeon/content';
import { generateId } from '../utils/id.js';
/** Returns true if the enemy that killed the player should be promoted to a nemesis */
export function shouldPromoteToNemesis(state, enemy, floor, rng) {
    if (floor < NEMESIS_PROMOTION.minFloorForPromotion)
        return false;
    // First death ever always promotes — teaches the mechanic
    if (state.world.nemeses.length === 0)
        return true;
    const activeCount = state.world.nemeses.filter(n => n.isActive).length;
    if (activeCount >= NEMESIS_PROMOTION.maxActiveNemeses)
        return false;
    const chance = NEMESIS_PROMOTION.promotionChanceByTier[enemy.tier] ?? 0.15;
    return rng.next() < chance;
}
/** Promote an enemy to a nemesis after it kills the player */
export function promoteToNemesis(state, enemy, floor, rng) {
    const nemesisId = entityId(generateId());
    // Determine rank: each re-promotion of same template increases rank
    const existingByTemplate = state.world.nemeses.filter(n => n.sourceTemplateId === enemy.templateId);
    const rank = Math.min(3, existingByTemplate.length + 1);
    const multiplier = NEMESIS_PROMOTION.statMultiplierByRank[rank] ?? 1.2;
    let maxHealth = Math.round(enemy.stats.maxHealth * multiplier);
    // Ensure nemesis has minimum health to prevent 1-shot kills on weak tier-1 enemies
    const minHp = 50 + floor * 5;
    if (maxHealth < minHp)
        maxHealth = minHp;
    const boostedStats = {
        maxHealth,
        health: maxHealth,
        attack: Math.round(enemy.stats.attack * multiplier),
        defense: Math.round(enemy.stats.defense * multiplier),
        accuracy: enemy.stats.accuracy,
        evasion: enemy.stats.evasion,
        speed: enemy.stats.speed,
    };
    // If this template was previously slain with a weapon type, grant +3 defense adaptation
    const previousRecord = existingByTemplate.find(n => n.killedByWeaponType !== null);
    const equippedWeaponType = state.player.equipment.weapon !== null
        ? (() => {
            const tpl = state.itemRegistry.items.get(state.player.equipment.weapon);
            if (tpl !== undefined && tpl.itemClass === 'weapon')
                return tpl.weapon.weaponType;
            return null;
        })()
        : null;
    if (previousRecord != null && previousRecord.killedByWeaponType !== null && equippedWeaponType === previousRecord.killedByWeaponType) {
        boostedStats.defense = boostedStats.defense + 3;
    }
    const name = rng.pick(FALLBACK_NEMESIS_NAMES);
    const title = rng.pick(FALLBACK_NEMESIS_TITLES);
    const nemesis = {
        id: nemesisId,
        name,
        title,
        sourceTemplateId: enemy.templateId,
        rank,
        tier: enemy.tier,
        stats: boostedStats,
        traits: [],
        weaknesses: [],
        killEventId: null,
        encounterCount: 0,
        isActive: true,
        killCount: 1,
        floorOfAscension: floor,
        biomeOfAscension: state.run?.floor.biomeId ?? 'unknown',
        killedByWeaponType: null,
    };
    const event = {
        type: 'NEMESIS_PROMOTED',
        nemesisId,
        nemesisName: `${name} ${title}`,
        sourceTemplateId: enemy.templateId,
        floor,
        timestamp: Date.now(),
        turnNumber: state.turnNumber,
    };
    return {
        state: {
            ...state,
            world: {
                ...state.world,
                nemeses: [...state.world.nemeses, nemesis],
            },
        },
        events: [event],
    };
}
/** Given a nemesis ID, mark it as slain and return updated state + NEMESIS_SLAIN event */
export function slayNemesis(state, nemesisId, weaponType) {
    // Collect unlocked enchantments (blueprints)
    const allEnchantmentIds = Array.from(ENCHANTMENT_BY_ID.keys());
    const unlockedSet = new Set(state.world.unlockedBlueprints);
    const unlockedEnchantments = allEnchantmentIds.filter(id => unlockedSet.has(id));
    const unlockedIds = new Set(unlockedEnchantments);
    // Pick a random unlocked enchantment, or first unlocked if none available
    let blueprintToUnlock = null;
    const availableIds = allEnchantmentIds.filter(id => !unlockedIds.has(id));
    if (availableIds.length > 0) {
        // Use deterministic selection based on nemesis ID hash
        const hashCode = nemesisId.charCodeAt(0);
        blueprintToUnlock = availableIds[hashCode % availableIds.length];
    }
    // Get implied blueprints (lower tiers) and add them all
    let newBlueprints = [...state.world.unlockedBlueprints];
    if (blueprintToUnlock !== null) {
        const impliedIds = getImpliedBlueprints(blueprintToUnlock);
        newBlueprints = [...new Set([...newBlueprints, ...impliedIds])];
    }
    // Find the nemesis record to get its name
    const nemesis = state.world.nemeses.find(n => n.id === nemesisId);
    const nemesisName = nemesis !== undefined ? nemesis.name : 'Unknown Nemesis';
    const newState = {
        ...state,
        world: {
            ...state.world,
            unlockedBlueprints: newBlueprints,
            nemeses: state.world.nemeses.map(n => n.id === nemesisId
                ? { ...n, isActive: false, killedByWeaponType: weaponType ?? n.killedByWeaponType }
                : n),
        },
    };
    const event = {
        type: 'NEMESIS_SLAIN',
        nemesisId,
        nemesisName,
        blueprintUnlocked: blueprintToUnlock,
        lootItemName: null, // Will be filled in by server after AI loot generation
        floor: state.player.floor,
        timestamp: Date.now(),
        turnNumber: state.turnNumber,
    };
    return { state: newState, events: [event] };
}
/** Find an active nemesis that matches a killed enemy's templateId */
export function findNemesisByTemplateId(nemeses, templateId) {
    return nemeses.find(n => n.isActive && n.sourceTemplateId === templateId);
}
//# sourceMappingURL=nemesis.js.map