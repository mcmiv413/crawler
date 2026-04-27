import { MAX_EVENT_HISTORY, PROSPERITY_DELTAS, KILL_STREAK_BONUSES, NPC_THRESHOLDS, FEAR_ESCALATION, NEMESIS_SLAIN_WORLD_EFFECTS, } from '@dungeon/content';
import { tickFactionPowerForNemeses } from './factions.js';
import { clamp } from '../utils/math.js';
function applyTownDelta(town, turnNumber, field, delta) {
    const oldVal = town[field];
    const newVal = clamp(oldVal + delta, 0, 100);
    if (newVal === oldVal)
        return { town, event: null };
    const event = {
        type: 'TOWN_STATE_CHANGED',
        field,
        oldValue: oldVal,
        newValue: newVal,
        timestamp: Date.now(),
        turnNumber,
    };
    return { town: { ...town, [field]: newVal }, event };
}
/** Apply world consequences when a run ends (death, retreat, or victory) */
export function applyRunConsequences(state, metrics) {
    let events = [];
    let town = state.world.town;
    const cause = metrics.causeOfEnd;
    // Prosperity changes
    let prosperityDelta = 0;
    if (cause === 'death') {
        prosperityDelta = PROSPERITY_DELTAS.onDeath;
    }
    else if (cause === 'retreat') {
        // Reward for how deep they went
        prosperityDelta = Math.min(8, Math.max(1, metrics.floorsCleared * PROSPERITY_DELTAS.onRetreatPerFloor));
    }
    else if (cause === 'victory') {
        prosperityDelta = PROSPERITY_DELTAS.onVictoryBase + metrics.floorsCleared * PROSPERITY_DELTAS.onVictoryPerFloor;
    }
    // Bonus for killing lots of enemies
    if (metrics.enemiesKilled >= KILL_STREAK_BONUSES.tier1Kills)
        prosperityDelta += KILL_STREAK_BONUSES.tier1Bonus;
    if (metrics.enemiesKilled >= KILL_STREAK_BONUSES.tier2Kills)
        prosperityDelta += KILL_STREAK_BONUSES.tier2Bonus;
    // Corruption from active nemeses
    const activeNemesisCount = state.world.nemeses.filter(n => n.isActive).length;
    const corruptionDelta = activeNemesisCount * NEMESIS_SLAIN_WORLD_EFFECTS.corruptionPerActiveNemesis;
    // Apply deltas
    let result = applyTownDelta(town, state.turnNumber, 'prosperity', prosperityDelta);
    town = result.town;
    if (result.event !== null)
        events = [...events, result.event];
    result = applyTownDelta(town, state.turnNumber, 'corruption', corruptionDelta);
    town = result.town;
    if (result.event !== null)
        events = [...events, result.event];
    let newState = {
        ...state,
        world: { ...state.world, town, totalRuns: state.world.totalRuns + 1 },
    };
    // Tick faction power for active nemeses
    newState = tickFactionPowerForNemeses(newState);
    // Sync shopkeeper availability based on prosperity
    newState = syncNpcAvailability(newState);
    // Evaluate event chains (4D)
    const chainResult = evaluateEventChains(newState);
    newState = chainResult.state;
    events = [...events, ...chainResult.events];
    // Cap event history to prevent unbounded growth
    if (newState.world.eventHistory.length > MAX_EVENT_HISTORY) {
        newState = {
            ...newState,
            world: {
                ...newState.world,
                eventHistory: newState.world.eventHistory.slice(-MAX_EVENT_HISTORY),
            },
        };
    }
    return { state: newState, events };
}
function syncNpcAvailability(state) {
    const prosperity = state.world.town.prosperity;
    const updatedNpcs = state.world.npcs.map(npc => {
        if (npc.role === 'shopkeeper') {
            if (prosperity < NPC_THRESHOLDS.shopkeeperLeavesProsperity && npc.available === true) {
                return { ...npc, available: false };
            }
            if (prosperity >= NPC_THRESHOLDS.shopkeeperReturnsProsperity && npc.available !== true) {
                return { ...npc, available: true };
            }
        }
        return npc;
    });
    return { ...state, world: { ...state.world, npcs: updatedNpcs } };
}
/**
 * Phase 4D — Event chain evaluation.
 * Scans recent world event history and triggers cascading world consequences.
 */
export function evaluateEventChains(state) {
    let events = [];
    const history = state.world.eventHistory;
    let town = state.world.town;
    let factions = state.world.factions;
    // Chain 1: 3+ deaths in recent history → fear spike
    const recentDeaths = history.slice(-FEAR_ESCALATION.recentEventWindow).filter(e => e.type === 'PLAYER_DIED').length;
    if (recentDeaths >= FEAR_ESCALATION.deathsToTrigger && town.fear < FEAR_ESCALATION.fearCap) {
        const result = applyTownDelta(town, state.turnNumber, 'fear', FEAR_ESCALATION.fearGain);
        town = result.town;
        if (result.event !== null)
            events = [...events, result.event];
    }
    // A7: Chain 2: recent nemesis kill → prosperity boost, corruption drop
    const recentNemesisKills = history.slice(-10).filter(e => e.type === 'NEMESIS_SLAIN').length;
    const activeNemeses = state.world.nemeses.filter(n => n.isActive).length;
    if (recentNemesisKills > 0 && activeNemeses === 0) {
        // All nemeses are slain — reward
        let result = applyTownDelta(town, state.turnNumber, 'prosperity', NEMESIS_SLAIN_WORLD_EFFECTS.prosperityGain);
        town = result.town;
        if (result.event !== null)
            events = [...events, result.event];
        result = applyTownDelta(town, state.turnNumber, 'corruption', -NEMESIS_SLAIN_WORLD_EFFECTS.corruptionLoss);
        town = result.town;
        if (result.event !== null)
            events = [...events, result.event];
    }
    // Chain 3: A faction at 0 power → their disposition improves (broken/scattered)
    factions = factions.map(f => f.power === 0 && f.disposition < -10
        ? { ...f, disposition: Math.min(-10, f.disposition + 20) }
        : f);
    const newState = {
        ...state,
        world: { ...state.world, town, factions },
    };
    return { state: newState, events };
}
//# sourceMappingURL=world-consequences.js.map