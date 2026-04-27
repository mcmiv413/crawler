/** Add an ability to the player's ability list (idempotent) */
export function grantAbility(state, abilityId) {
    if (state.player.abilities.some(a => a.id === abilityId))
        return state;
    return {
        ...state,
        player: {
            ...state.player,
            abilities: [...state.player.abilities, { id: abilityId, cooldownRemaining: 0 }],
        },
    };
}
/** Decrement all non-zero ability cooldowns by 1 */
export function tickAbilityCooldowns(state) {
    if (state.player.abilities.length === 0)
        return state;
    return {
        ...state,
        player: {
            ...state.player,
            abilities: state.player.abilities.map(a => ({
                ...a,
                cooldownRemaining: Math.max(0, a.cooldownRemaining - 1),
            })),
        },
    };
}
/** Check if the player can use the given ability right now */
export function canUseAbility(state, abilityId) {
    const ability = state.player.abilities.find(a => a.id === abilityId);
    return ability !== undefined && ability.cooldownRemaining === 0;
}
/** Check if an enemy can use the given ability right now */
export function canEnemyUseAbility(enemy, abilityId) {
    if (!enemy.abilities || !enemy.abilities.includes(abilityId))
        return false;
    const cooldown = enemy.abilityCooldowns?.[abilityId] ?? 0;
    return cooldown === 0;
}
/** Set an ability's cooldown (used after activation) */
export function setAbilityCooldown(state, abilityId, cooldown) {
    return {
        ...state,
        player: {
            ...state.player,
            abilities: state.player.abilities.map(a => a.id === abilityId ? { ...a, cooldownRemaining: cooldown } : a),
        },
    };
}
//# sourceMappingURL=abilities.js.map