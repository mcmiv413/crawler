/**
 * Build an ability context from game state and optional target.
 * Does not execute anything; just prepares the context for the runtime.
 */
export function buildContext(state, rng, targetId) {
    let target;
    if (targetId !== undefined && state.run !== null) {
        for (const [key, enemy] of state.run.enemies) {
            if (enemy.id === targetId) {
                target = { instance: enemy, key };
                break;
            }
        }
    }
    return {
        state,
        rng,
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target,
    };
}
//# sourceMappingURL=build-context.js.map