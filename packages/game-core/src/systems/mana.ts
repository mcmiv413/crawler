import type { DomainEvent, GameState } from '@dungeon/contracts';
import { MAGIC } from '@dungeon/content';

export function canAffordMana(mana: number, cost: number): boolean {
  return mana >= cost;
}

export const canAfordMana = canAffordMana;

export function deductMana(current: number, cost: number): number {
  return Math.max(0, current - cost);
}

export function restoreMana(current: number, max: number, amount: number): number {
  return Math.min(max, current + amount);
}

export function regenerateMana(current: number, max: number): number {
  return Math.min(max, current + MAGIC.manaRegenPerActiveTurn);
}

export function changeMana(
  state: GameState,
  amount: number,
  reason: string,
): { state: GameState; events: DomainEvent[] } {
  const newMana = Math.max(0, Math.min(state.player.maxMana, state.player.mana + amount));
  const delta = newMana - state.player.mana;
  if (delta === 0) return { state, events: [] };

  return {
    state: {
      ...state,
      player: {
        ...state.player,
        mana: newMana,
      },
    },
    events: [{
      type: 'MANA_CHANGED',
      playerId: state.player.id,
      amount: delta,
      newTotal: newMana,
      reason,
      timestamp: state.turnNumber,
      turnNumber: state.turnNumber,
    }],
  };
}

export function spendMana(
  state: GameState,
  cost: number,
  reason: string,
): { state: GameState; events: DomainEvent[] } {
  return changeMana(state, -cost, reason);
}

export function restorePlayerMana(
  state: GameState,
  amount: number,
  reason: string,
): { state: GameState; events: DomainEvent[] } {
  return changeMana(state, amount, reason);
}

export function regenerateManaForActiveTurn(
  state: GameState,
): { state: GameState; events: DomainEvent[] } {
  const playerIsStunned = state.player.statuses.some(status => status.id === 'stun');
  if (playerIsStunned === true) return { state, events: [] };
  return restorePlayerMana(state, MAGIC.manaRegenPerActiveTurn, 'Active turn');
}
