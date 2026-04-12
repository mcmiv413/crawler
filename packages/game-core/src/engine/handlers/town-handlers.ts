import type { GameState, TownActionType, EntityId } from '@dungeon/contracts';
import type { CommandResult } from './shared.js';
import type { SeededRNG } from '../../utils/rng.js';
import { processTownAction } from '../../systems/town.js';

export function handleTownAction(
  state: GameState,
  action: TownActionType,
  rng: SeededRNG,
  targetId?: EntityId,
  itemId?: string,
): CommandResult {
  if (state.phase !== 'town') return { state, events: [], runEnded: false };
  const result = processTownAction(state, action, targetId, itemId, rng);
  return { state: result.state, events: result.events, runEnded: false };
}
