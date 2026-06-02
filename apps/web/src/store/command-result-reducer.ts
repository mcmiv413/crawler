import type { GameView, CombatLogEntry } from '@dungeon/presenter';

export function appendCombatLog(
  current: readonly CombatLogEntry[],
  next: readonly CombatLogEntry[],
): CombatLogEntry[] {
  return [...current, ...next].slice(-50);
}

export function isDeathTransition(
  currentView: GameView | null,
  nextView: GameView,
): boolean {
  const dungeonToEndPhase =
    currentView !== null &&
    currentView.phase === 'dungeon' &&
    (nextView.phase === 'town' || nextView.phase === 'game_over');

  const hasDeathSignal =
    Boolean(nextView.deathContext?.killerName) ||
    nextView.runResult === 'permadeath';

  return dungeonToEndPhase && hasDeathSignal;
}
