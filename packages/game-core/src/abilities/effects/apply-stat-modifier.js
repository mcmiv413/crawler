/**
 * Apply a stat modifier effect to a target.
 */
export function applyStatModifier(context, effect, targetKey) {
    let newState = context.state;
    const events = [];
    // Check trigger condition
    if (effect.trigger === 'on_hit') {
        // Note: on_hit is only checked when called from apply-conditional or after attack
        // For now, we assume if this is called, the attack hit
    }
    if (newState.run === null) {
        return { state: newState, events };
    }
    const target = newState.run.enemies.get(targetKey);
    if (target === undefined) {
        return { state: newState, events };
    }
    const currentValue = target.stats[effect.stat];
    let newValue = currentValue;
    if (effect.operation === 'add') {
        newValue = currentValue + effect.amount;
    }
    else {
        // operation must be 'subtract'
        newValue = Math.max(effect.minimum ?? 0, currentValue - effect.amount);
    }
    const modifiedEnemy = {
        ...target,
        stats: { ...target.stats, [effect.stat]: newValue },
    };
    const currentRun = newState.run;
    const newEnemies = new Map(currentRun.enemies);
    newEnemies.set(targetKey, modifiedEnemy);
    newState = { ...newState, run: { ...currentRun, enemies: newEnemies } };
    return { state: newState, events };
}
//# sourceMappingURL=apply-stat-modifier.js.map