import type { GameState } from '@dungeon/contracts';
import type { DeathSummary } from '../game-view.js';

export function buildDeathSummary(state: GameState): DeathSummary | null {
  if (state.phase !== 'game_over') return null;
  const metrics = state.run?.runMetrics;
  if (!metrics || metrics.causeOfEnd === 'victory') return null;

  // Try to find the killer from recent event history
  const recentEvents = state.world.eventHistory.slice(-20);
  const playerDiedEvent = recentEvents.find(e => e.type === 'PLAYER_DIED');

  // Find killer name by looking at the last attack that hit the player before death
  let killerName: string | null = null;
  if (playerDiedEvent && playerDiedEvent.type === 'PLAYER_DIED') {
    // Look for the most recent attack against the player
    const attacks = recentEvents.filter(
      e => e.type === 'ATTACK_PERFORMED' && e.defenderId === state.player.id && e.hit,
    );
    const lastAttack = attacks[attacks.length - 1];
    if (lastAttack && lastAttack.type === 'ATTACK_PERFORMED') {
      killerName = lastAttack.attackerName;
    }
  }

  return {
    killerName,
    floor: state.player.floor,
    turnsSurvived: metrics.turnsElapsed,
    damageDealt: metrics.damageDealt,
    damageTaken: metrics.damageTaken,
  };
}
