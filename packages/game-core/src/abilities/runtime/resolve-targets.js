/**
 * Resolve target(s) based on the targeting specification.
 * If a targetId is provided, it takes precedence over the targeting definition's requestedTargetId.
 */
export function resolveTargets(context, targeting, targetId) {
    // Use the provided targetId, falling back to the definition's requestedTargetId
    const requestedId = targetId ?? targeting.requestedTargetId;
    return resolveSelector(context, targeting.selector, requestedId);
}
function resolveSelector(context, selector, requestedTargetId) {
    if (context.run === null) {
        return [];
    }
    switch (selector.kind) {
        case 'self':
            return [];
        case 'single_enemy': {
            if (requestedTargetId === undefined) {
                return [];
            }
            for (const [key, enemy] of context.run.enemies) {
                if (enemy.id === requestedTargetId) {
                    return [{ enemy, key }];
                }
            }
            return [];
        }
        case 'nearest_enemy_melee': {
            // Find nearest enemy within melee range (distance <= 1)
            let nearest = null;
            let minDist = Infinity;
            for (const [key, enemy] of context.run.enemies) {
                const dist = Math.abs(context.player.position.x - enemy.position.x) +
                    Math.abs(context.player.position.y - enemy.position.y);
                if (dist <= 1 && dist < minDist) {
                    minDist = dist;
                    nearest = { enemy, key };
                }
            }
            return nearest !== null ? [nearest] : [];
        }
        case 'nearest_visible_enemy': {
            // Find nearest visible enemy (for now, all enemies are "visible" if not hidden)
            let nearest = null;
            let minDist = Infinity;
            for (const [key, enemy] of context.run.enemies) {
                const dist = Math.abs(context.player.position.x - enemy.position.x) +
                    Math.abs(context.player.position.y - enemy.position.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = { enemy, key };
                }
            }
            return nearest !== null ? [nearest] : [];
        }
        case 'all_visible_enemies': {
            const mutableTargets = [];
            for (const [key, enemy] of context.run.enemies) {
                const cell = context.run.floor.cells.get(key);
                if (cell?.visibility === 'visible') {
                    mutableTargets.push({ enemy, key });
                }
            }
            return mutableTargets;
        }
        case 'target_plus_adjacent_enemies': {
            const mutableTargets = [];
            // Add primary target first
            if (context.target !== undefined) {
                mutableTargets.push({ enemy: context.target.instance, key: context.target.key });
                // Add adjacent enemies
                const tx = context.target.instance.position.x;
                const ty = context.target.instance.position.y;
                for (const [key, enemy] of context.run.enemies) {
                    if (enemy.id === context.target.instance.id)
                        continue;
                    const dx = Math.abs(enemy.position.x - tx);
                    const dy = Math.abs(enemy.position.y - ty);
                    if (dx <= 1 && dy <= 1) {
                        const cell = context.run.floor.cells.get(key);
                        if (cell?.visibility === 'visible') {
                            mutableTargets.push({ enemy, key });
                        }
                    }
                }
            }
            return mutableTargets;
        }
        default:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            throw new Error(`Unknown selector kind: ${selector.kind}`);
    }
}
//# sourceMappingURL=resolve-targets.js.map