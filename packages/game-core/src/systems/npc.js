import { createQuestFromTemplate, selectRandomQuestTemplate } from '@dungeon/content';
import { SeededRNG as SeededRNGImpl } from '../utils/rng.js';
/**
 * Updates an NPC's disposition by a delta amount (clamped to 0-100).
 * Returns a new NPC array with the updated disposition.
 */
export function updateNpcDisposition(npcs, npcId, delta) {
    return npcs.map(n => n.id === npcId ? { ...n, disposition: Math.min(100, Math.max(0, n.disposition + delta)) } : n);
}
export function processTalkNpc(state, npcId, rng) {
    if (npcId === undefined)
        return { state, events: [] };
    const npc = state.world.npcs.find(n => n.id === npcId);
    if (npc === undefined)
        return { state, events: [] };
    const events = [];
    // Informant: assign a retrieve quest on first conversation if disposition is high enough
    if (npc.role === 'informant') {
        const hasActiveQuest = state.activeQuests.some(q => q.giverNpcId === npcId && q.status === 'active');
        if (hasActiveQuest !== true) {
            // Disposition too low — informant won't share information yet
            if (npc.disposition < 20) {
                return {
                    state: {
                        ...state,
                        world: {
                            ...state.world,
                            npcs: updateNpcDisposition(state.world.npcs, npcId, 2),
                        },
                    },
                    events,
                };
            }
            // D3: Select a random quest template using RNG for non-deterministic variety
            // If rng not provided, create a seed-based RNG from turn number (fallback for tests)
            const rngSource = rng ?? new SeededRNGImpl(state.turnNumber);
            const template = selectRandomQuestTemplate(() => rngSource.next());
            const quest = createQuestFromTemplate(template, npcId, state.turnNumber);
            const newState = {
                ...state,
                activeQuests: [...state.activeQuests, quest],
                world: {
                    ...state.world,
                    npcs: updateNpcDisposition(state.world.npcs, npcId, 5),
                },
            };
            return {
                state: newState,
                events: [...events, {
                        type: 'QUEST_ASSIGNED',
                        questId: quest.id,
                        questTitle: quest.title,
                        questDescription: quest.description,
                        rewardGold: quest.rewardGold,
                        giverNpcId: npcId,
                        timestamp: Date.now(),
                        turnNumber: state.turnNumber,
                    }],
            };
        }
    }
    // Small disposition bump for talking
    const newState = {
        ...state,
        world: {
            ...state.world,
            npcs: updateNpcDisposition(state.world.npcs, npcId, 2),
        },
    };
    return { state: newState, events };
}
//# sourceMappingURL=npc.js.map