import type { GameState, RunMetrics, DomainEvent, TownState } from '@dungeon/contracts';
import {
  MAX_EVENT_HISTORY,
  PROSPERITY_DELTAS,
  KILL_STREAK_BONUSES,
  NPC_THRESHOLDS,
  FEAR_ESCALATION,
} from '@dungeon/content';
import { clamp } from '../utils/math.js';
import { calculateFactionTownImpact } from './factions.js';

function applyTownDelta(
  town: TownState,
  turnNumber: number,
  field: 'prosperity' | 'corruption' | 'fear',
  delta: number,
): { town: TownState; event: DomainEvent | null } {
  const oldVal = town[field];
  const newVal = clamp(oldVal + delta, 0, 100);
  if (newVal === oldVal) return { town, event: null };
  const event: DomainEvent = {
    type: 'TOWN_STATE_CHANGED',
    field,
    oldValue: oldVal,
    newValue: newVal,
    timestamp: turnNumber,
    turnNumber,
  };
  return { town: { ...town, [field]: newVal }, event };
}

/** Apply world consequences when a run ends (death, retreat, or victory) */
export function applyRunConsequences(
  state: GameState,
  metrics: RunMetrics,
  recentEvents: readonly DomainEvent[] = [],
): { state: GameState; events: DomainEvent[] } {
  let events: DomainEvent[] = [];
  let town = state.world.town;
  const cause = metrics.causeOfEnd;

  // Prosperity changes
  let prosperityDelta = 0;
  if (cause === 'death') {
    prosperityDelta = PROSPERITY_DELTAS.onDeath;
  } else if (cause === 'retreat') {
    // Reward for how deep they went
    prosperityDelta = Math.min(8, Math.max(1, metrics.floorsCleared * PROSPERITY_DELTAS.onRetreatPerFloor));
  } else if (cause === 'victory') {
    prosperityDelta = PROSPERITY_DELTAS.onVictoryBase + metrics.floorsCleared * PROSPERITY_DELTAS.onVictoryPerFloor;
  }

  // Bonus for killing lots of enemies
  if (metrics.enemiesKilled >= KILL_STREAK_BONUSES.tier1Kills) prosperityDelta += KILL_STREAK_BONUSES.tier1Bonus;
  if (metrics.enemiesKilled >= KILL_STREAK_BONUSES.tier2Kills) prosperityDelta += KILL_STREAK_BONUSES.tier2Bonus;

  // Apply base prosperity delta from run outcome
  const prosperityResult = applyTownDelta(town, state.turnNumber, 'prosperity', prosperityDelta);
  town = prosperityResult.town;
  if (prosperityResult.event !== null) events = [...events, prosperityResult.event];

  const factionImpact = calculateFactionTownImpact(state.world.factions);
  const factionProsperityResult = applyTownDelta(town, state.turnNumber, 'prosperity', factionImpact.prosperityDelta);
  town = factionProsperityResult.town;
  if (factionProsperityResult.event !== null) events = [...events, factionProsperityResult.event];

  const factionCorruptionResult = applyTownDelta(town, state.turnNumber, 'corruption', factionImpact.corruptionDelta);
  town = factionCorruptionResult.town;
  if (factionCorruptionResult.event !== null) events = [...events, factionCorruptionResult.event];

  let newState: GameState = {
    ...state,
    world: { ...state.world, town, totalRuns: state.world.totalRuns + 1 },
  };

  // Sync shopkeeper availability based on prosperity
  newState = syncNpcAvailability(newState);

  // Evaluate event chains (4D)
  const chainResult = evaluateEventChains(
    newState,
    [...newState.world.eventHistory, ...recentEvents, ...events],
  );
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

function syncNpcAvailability(state: GameState): GameState {
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
export function evaluateEventChains(
  state: GameState,
  history: readonly DomainEvent[] = state.world.eventHistory,
): { state: GameState; events: DomainEvent[] } {
  let events: DomainEvent[] = [];
  let town = state.world.town;

  // Chain 1: 3+ deaths in recent history → fear spike
  const recentDeaths = history.slice(-FEAR_ESCALATION.recentEventWindow).filter(e => e.type === 'PLAYER_DIED').length;
  if (recentDeaths >= FEAR_ESCALATION.deathsToTrigger && town.fear < FEAR_ESCALATION.fearCap) {
    const result = applyTownDelta(town, state.turnNumber, 'fear', FEAR_ESCALATION.fearGain);
    town = result.town;
    if (result.event !== null) events = [...events, result.event];
  }

  const newState: GameState = {
    ...state,
    world: { ...state.world, town },
  };

  return { state: newState, events };
}
