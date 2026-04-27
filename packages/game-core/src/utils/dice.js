import { clamp } from './math.js';
/** Roll result with variance applied */
export function rollDamage(base, variance, rng) {
    const multiplier = 1 + rng.float(-variance, variance);
    return Math.max(1, Math.round(base * multiplier));
}
/** Roll damage result between min and max values */
export function rollDamageBetween(min, max, rng) {
    const range = max - min;
    const roll = Math.round(min + rng.float(0, range));
    return Math.max(1, roll);
}
/** Calculate hit chance: base + accuracy - evasion, clamped */
export function calculateHitChance(baseHitChance, accuracy, evasion, minChance, maxChance) {
    const raw = baseHitChance + accuracy - evasion;
    return clamp(raw, minChance, maxChance);
}
/** Defense mitigation: damage * (1 - defense / (defense + divisor)) */
export function applyDefense(damage, defense, divisor) {
    const reduction = defense / (defense + divisor);
    return Math.max(1, Math.round(damage * (1 - reduction)));
}
/** Apply range accuracy penalty: -dropPerTile% for each tile beyond minRange */
export function applyRangeAccuracyPenalty(accuracy, distance, minRange, dropPerTile) {
    const tilesOverMin = Math.max(0, distance - minRange);
    return Math.max(0, accuracy - tilesOverMin * dropPerTile);
}
//# sourceMappingURL=dice.js.map