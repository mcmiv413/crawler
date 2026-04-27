import { ENCHANTMENT_BY_ID, thorns, hpRegen, expBonus, blink, lifeSteal } from '@dungeon/content';
import { applyDamageToEnemy } from './damage.js';
const ARMOR_SLOTS = ['chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'];
/** Collect all active enchantment IDs from all equipped armor slots */
function getEquippedEnchantments(state) {
    let ids = [];
    for (const slot of ARMOR_SLOTS) {
        const itemId = state.player.equipment[slot];
        if (itemId === null)
            continue;
        const template = state.itemRegistry.items.get(itemId);
        if (template === undefined || template.itemClass !== 'armor')
            continue;
        for (const enc of template.armor.enchantments) {
            if (enc !== null)
                ids = [...ids, enc];
        }
    }
    return ids;
}
/** Sum effect values for a specific enchantment type from all equipped armor */
function sumEnchantmentEffect(state, effectType) {
    let total = 0;
    for (const encId of getEquippedEnchantments(state)) {
        const def = ENCHANTMENT_BY_ID.get(encId);
        if (def?.effect.type === effectType && def.effect.value !== undefined) {
            total += def.effect.value;
        }
    }
    return total;
}
/** Sum total thorns/spikes reflect damage from all equipped armor */
export const getTotalThornsReflect = (state) => sumEnchantmentEffect(state, thorns.effect.type);
/** Get HP regen bonus per turn from enchantments */
export const getEnchantmentRegenBonus = (state) => sumEnchantmentEffect(state, hpRegen.effect.type);
/** Get XP multiplier from exp_bonus enchantments (stacks additively) */
export function getExpBonusMultiplier(state) {
    return 1.0 + sumEnchantmentEffect(state, expBonus.effect.type);
}
/**
 * Apply thorns/spikes reflect damage to an attacker via central damage system.
 * Thorns bypass both defense and resistance (pure reflect damage).
 */
export function applyThornsToAttacker(state, enemy, thornsAmount) {
    if (thornsAmount <= 0) {
        return { state, finalDamage: 0, killed: false };
    }
    return applyDamageToEnemy(state, enemy.id, {
        amount: thornsAmount,
        damageType: 'physical',
        source: 'thorns',
        bypassDefense: true,
        bypassResistance: true,
    });
}
/**
 * Check if blink triggers when player is hit.
 * Returns true if the hit is blocked (teleport dodged it).
 * @param rngNext — returns a float in [0,1)
 */
export function applyBlinkOnHit(state, rngNext) {
    const enchantments = getEquippedEnchantments(state);
    if (!enchantments.includes(blink.id))
        return false;
    const roll = rngNext();
    return roll < 0.3;
}
/**
 * Get HP healed on kill from life_steal enchantments.
 */
export const applyLifeStealOnKill = (state) => sumEnchantmentEffect(state, lifeSteal.id);
//# sourceMappingURL=enchantment-hooks.js.map