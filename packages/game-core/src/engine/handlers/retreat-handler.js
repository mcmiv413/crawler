import { canRetreat, executeRetreat } from '../../systems/retreat.js';
export function handleRetreatCommand(state, rng) {
    const validation = canRetreat(state);
    if (validation !== true)
        return { state, events: [], runEnded: false };
    const result = executeRetreat(state, rng);
    return { state: result.state, events: result.events, runEnded: true };
}
//# sourceMappingURL=retreat-handler.js.map