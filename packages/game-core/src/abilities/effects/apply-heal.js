/**
 * Apply a heal effect to the player.
 */
export function applyHeal(context, effect) {
    const maxHealth = context.player.stats.maxHealth;
    const currentHealth = context.player.stats.health;
    let healAmount = 0;
    if (effect.percentageOfMaxHealth !== undefined) {
        healAmount = Math.floor(maxHealth * effect.percentageOfMaxHealth);
    }
    else if (effect.flatAmount !== undefined) {
        healAmount = effect.flatAmount;
    }
    const newHealth = Math.min(maxHealth, currentHealth + healAmount);
    const newState = {
        ...context.state,
        player: { ...context.player, stats: { ...context.player.stats, health: newHealth } },
    };
    return {
        state: newState,
        events: [],
        healAmount,
    };
}
//# sourceMappingURL=apply-heal.js.map