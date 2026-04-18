import type { GameState, GameCommand, DomainEvent } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
import { updateRunMetrics } from './handlers/shared.js';
import { processEnemyTurns } from './turn-scheduler.js';
import { tickAbilityCooldowns } from '../systems/abilities.js';

/** Turn cost for each command type */
export const ACTION_TURN_COST: Record<GameCommand['type'], number> = {
  MOVE: 1,
  ATTACK: 1,
  WAIT: 1,
  USE_ITEM: 1,
  USE_ABILITY: 1,
  SWAP_WEAPONS: 1,
  INTERACT: 1,
  DISARM_TRAP: 1,
  SET_TRAP: 1,
  EQUIP: 0,
  UNEQUIP: 0,
  RETREAT: 0,
  TOWN_ACTION: 0,
  ASCEND: 0,
  ENCHANT_ARMOR: 0,
  TOGGLE_DEBUG: 0,
};

/** Result from a command handler before post-action finalization */
export interface ActionOutcome {
  readonly state: GameState;
  readonly events: readonly DomainEvent[];
  readonly runEnded?: boolean;
}

/** Final result after post-action bookkeeping (turn increment, metrics, enemy turns, cooldown ticks) */
export interface CommandResult {
  readonly state: GameState;
  readonly events: readonly DomainEvent[];
  readonly runEnded: boolean;
}

/**
 * Finalize an action after a command handler completes.
 * Handles:
 * - Turn number increment
 * - Run metrics updates
 * - Enemy turn processing
 * - Ability cooldown ticking
 */
export function finalizeAction(
  outcome: ActionOutcome,
  turns: number,
  rng: SeededRNG,
): CommandResult {
  // Free actions or run-ending actions skip post-action processing
  if (turns === 0 || outcome.runEnded === true) {
    return {
      state: outcome.state,
      events: outcome.events,
      runEnded: outcome.runEnded ?? false,
    };
  }

  // Don't process enemy turns in town
  const isInTown = outcome.state.run === null;
  if (isInTown === true) {
    return {
      state: outcome.state,
      events: outcome.events,
      runEnded: outcome.runEnded ?? false,
    };
  }

  let state = {
    ...outcome.state,
    turnNumber: outcome.state.turnNumber + turns,
  };

  // Update run metrics with turns elapsed
  state = updateRunMetrics(state, { turnsElapsed: turns });

  // Process enemy turns (passing player speed for MOVE actions)
  const enemyResult = processEnemyTurns(state, rng, state.player.stats.speed);
  state = enemyResult.state;

  // Tick ability cooldowns
  state = tickAbilityCooldowns(state);

  return {
    state,
    events: [...outcome.events, ...enemyResult.events],
    runEnded: outcome.runEnded ?? false,
  };
}
