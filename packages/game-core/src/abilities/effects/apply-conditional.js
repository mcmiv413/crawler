import { applyEffect } from './apply-effect.js';
/**
 * Apply a conditional effect.
 * Evaluates the when condition, then applies then/otherwise effects.
 */
export function applyConditional(context, effect, targetKey, priorHit) {
    if (context.state.run === null) {
        return { state: context.state, events: [] };
    }
    const target = context.state.run.enemies.get(targetKey);
    const conditionMet = evaluateCondition(context, effect.when, priorHit, target);
    const effects = conditionMet === true ? effect.then : effect.otherwise ?? [];
    let newContext = context;
    let accumulatedEvents = [];
    for (const subEffect of effects) {
        const result = applyEffect(newContext, subEffect, targetKey, priorHit);
        newContext = { ...newContext, state: result.state };
        accumulatedEvents = [...accumulatedEvents, ...result.events];
    }
    return { state: newContext.state, events: accumulatedEvents };
}
function evaluateCondition(_context, condition, priorHit, target) {
    switch (condition.kind) {
        case 'attack_hit':
            return priorHit;
        case 'target_below_hp_pct': {
            if (target === undefined)
                return false;
            const hpPct = target.stats.health / target.stats.maxHealth;
            return hpPct < condition.percentage;
        }
        default:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            throw new Error(`Unknown condition kind: ${condition.kind}`);
    }
}
//# sourceMappingURL=apply-conditional.js.map