import type { GameState, DomainEvent } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
import { applyActiveTurnManaRegen } from './handlers/shared.js';
import { processEnemyTurns } from './turn-scheduler.js';
import { tickAbilityCooldowns } from '../systems/abilities.js';

export function advanceTurnAfterPlayerAction(
  state: GameState,
  events: readonly DomainEvent[],
  rng: SeededRNG,
): { state: GameState; events: DomainEvent[]; runEnded: boolean } {
  let newState = state;
  let newEvents = [...events];

  const manaResult = applyActiveTurnManaRegen(newState, newEvents);
  newState = manaResult.state;
  newEvents = manaResult.events;

  const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
  newState = enemyResult.state;
  newEvents = [...newEvents, ...enemyResult.events];
  newState = tickAbilityCooldowns(newState);

  const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
  return { state: newState, events: newEvents, runEnded };
}
