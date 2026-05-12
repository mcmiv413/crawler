import type { GameState, EntityId } from '@dungeon/contracts';
import type { SeededRNG } from '../../utils/rng.js';
import type { CommandResult } from './shared.js';
import { applyActiveTurnManaRegen, updateRunMetrics } from './shared.js';
import { useConsumable } from '../../systems/inventory.js';
import { equipItem, unequipItem, swapWeaponSets } from '../../systems/equipment.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';
import { isPlayerThreatened } from '../../systems/threat.js';

export function handleEquip(state: GameState, itemId: string): CommandResult {
  // Block equip if player is threatened (under immediate attack range)
  if (state.phase === 'dungeon' && isPlayerThreatened(state)) {
    return {
      state,
      events: [{
        type: 'EQUIP_BLOCKED',
        reason: 'Cannot change equipment while enemies are in threat range.',
        timestamp: state.turnNumber,
        turnNumber: state.turnNumber,
      }],
      runEnded: false,
    };
  }

  const result = equipItem(state, itemId as EntityId);
  return { state: result.state, events: result.events, runEnded: false };
}

export function handleUnequip(state: GameState, itemId: string): CommandResult {
  // Block unequip if player is threatened (under immediate attack range)
  if (state.phase === 'dungeon' && isPlayerThreatened(state)) {
    return {
      state,
      events: [{
        type: 'EQUIP_BLOCKED',
        reason: 'Cannot change equipment while enemies are in threat range.',
        timestamp: state.turnNumber,
        turnNumber: state.turnNumber,
      }],
      runEnded: false,
    };
  }

  const result = unequipItem(state, itemId as EntityId);
  return { state: result.state, events: result.events, runEnded: false };
}

export function handleSwapWeapons(state: GameState, rng: SeededRNG): CommandResult {
  if (state.phase === 'dungeon' && state.run) {
    const result = swapWeaponSets(state);
    let newState = result.state;
    let events = [...result.events];

    // Weapon swap is a free action, but still consumes a turn for enemies
    newState = updateRunMetrics(newState, { turnsElapsed: 1 });

    // Enemy turns with player speed for speed-based action accumulation
    const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
    newState = enemyResult.state;
    events = [...events, ...enemyResult.events];
    newState = tickAbilityCooldowns(newState);

    const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
    return { state: newState, events, runEnded };
  }
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
    const manaResult = applyActiveTurnManaRegen(newState, events);
    newState = manaResult.state;
    events = manaResult.events;

    // Enemy turns with player speed for speed-based action accumulation
    const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
    newState = enemyResult.state;
    events = [...events, ...enemyResult.events];
    newState = tickAbilityCooldowns(newState);

    const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
    return { state: newState, events, runEnded };
  }
  return { state, events: [], runEnded: false };
}
