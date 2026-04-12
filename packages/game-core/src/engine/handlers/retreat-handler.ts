import type { GameState } from '@dungeon/contracts';
import type { CommandResult } from './shared.js';
import type { SeededRNG } from '../../utils/rng.js';
import { canRetreat, executeRetreat } from '../../systems/retreat.js';

export function handleRetreatCommand(state: GameState, rng: SeededRNG): CommandResult {
  const validation = canRetreat(state);
  if (validation !== true) return { state, events: [], runEnded: false };

  const result = executeRetreat(state, rng);
  return { state: result.state, events: result.events, runEnded: true };
}
