import { evaluateQuestProgress } from '../systems/quest-progress.js';
/**
 * Evaluates progress on all active quests and returns any progress events.
 * Called after each game command to update quest status.
 */
export function evaluateAllQuestProgress(state) {
    let currentState = state;
    const mutableEvents = [];
    // Evaluate each active quest
    for (const quest of state.activeQuests) {
        const result = evaluateQuestProgress(quest, currentState);
        currentState = {
            ...currentState,
            activeQuests: currentState.activeQuests.map(q => q.id === quest.id ? result.quest : q),
        };
        mutableEvents.push(...result.events);
    }
    return { state: currentState, events: mutableEvents };
}
//# sourceMappingURL=quest-evaluator.js.map