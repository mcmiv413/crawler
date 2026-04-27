import { processTownAction } from '../../systems/town.js';
export function handleTownAction(state, action, rng, targetId, itemId) {
    if (state.phase !== 'town')
        return { state, events: [], runEnded: false };
    const result = processTownAction(state, action, targetId, itemId, rng);
    return { state: result.state, events: result.events, runEnded: false };
}
//# sourceMappingURL=town-handlers.js.map