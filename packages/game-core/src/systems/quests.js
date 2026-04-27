export function completeQuest(state, quest) {
    const updatedState = {
        ...state,
        activeQuests: state.activeQuests.map(q => q.id === quest.id ? { ...q, status: 'complete' } : q),
        player: { ...state.player, gold: state.player.gold + quest.rewardGold },
    };
    const event = {
        type: 'QUEST_COMPLETED',
        questId: quest.id,
        questTitle: quest.title,
        rewardGold: quest.rewardGold,
        timestamp: Date.now(),
        turnNumber: state.turnNumber,
    };
    return { state: updatedState, event };
}
export function completeFloorDepthQuests(state, newDepth) {
    const matchingQuests = state.activeQuests.filter(quest => quest.status === 'active' && quest.targetFloorDepth === newDepth);
    let currentState = state;
    let events = [];
    for (const quest of matchingQuests) {
        const result = completeQuest(currentState, quest);
        currentState = result.state;
        events = [...events, result.event];
    }
    return { state: currentState, events };
}
//# sourceMappingURL=quests.js.map