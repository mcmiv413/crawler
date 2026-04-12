import type { GameState, EntityId } from '@dungeon/contracts';
import type { SeededRNG } from '../../utils/rng.js';
import type { CommandResult } from './shared.js';
import { updateRunMetrics } from './shared.js';
import { useConsumable } from '../../systems/inventory.js';
import { equipItem, unequipItem, swapWeaponSets } from '../../systems/equipment.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';

export function handleEquip(state: GameState, itemId: string): CommandResult {
  const result = equipItem(state, itemId as EntityId);
  return { state: result.state, events: result.events, runEnded: false };
}

export function handleUnequip(state: GameState, itemId: string): CommandResult {
  const result = unequipItem(state, itemId as EntityId);
  return { state: result.state, events: result.events, runEnded: false };
}

export function handleSwapWeapons(state: GameState): CommandResult {
  const result = swapWeaponSets(state);
  return { state: result.state, events: result.events, runEnded: false };
}

export function handleUseItem(
  state: GameState,
  itemId: string,
  rng: SeededRNG,
  targetId?: EntityId,
): CommandResult {
  if (state.phase === 'dungeon' && state.run) {
    const result = useConsumable(state, itemId as EntityId, targetId);
    let newState = result.state;
    let events = [...result.events];
    newState = updateRunMetrics(newState, { itemsUsed: 1, turnsElapsed: 1 });

    // Enemy turns
    const enemyResult = processEnemyTurns(newState, rng);
    newState = enemyResult.state;
    events = [...events, ...enemyResult.events];
    newState = tickAbilityCooldowns(newState);

    const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
    return { state: newState, events, runEnded };
  }
  return { state, events: [], runEnded: false };
}
