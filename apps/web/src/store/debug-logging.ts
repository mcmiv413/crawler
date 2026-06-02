import type { GameView } from '@dungeon/presenter';

function isAttackCommand(command: unknown): boolean {
  return typeof command === 'object' &&
    command !== null &&
    (command as Record<string, unknown>).type === 'ATTACK';
}

function logDebugAttack(debugLogging: boolean, command: unknown, view: GameView | null): void {
  if (!debugLogging || !isAttackCommand(command)) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[DEBUG] Attack Command:', {
    playerAccuracy: view?.player.accuracy,
    playerAttack: view?.player.attack,
    command,
    timestamp: new Date().toISOString(),
  });
}

function logDebugCombatResult(debugLogging: boolean, view: GameView): void {
  if (!debugLogging || view.combatLog.length === 0) {
    return;
  }

  const lastEntry = view.combatLog[view.combatLog.length - 1];
  // eslint-disable-next-line no-console
  console.log('[DEBUG] Combat Result:', {
    lastLogEntry: lastEntry?.text,
    playerHealth: view.player.health,
    timestamp: new Date().toISOString(),
  });
}

export { isAttackCommand, logDebugAttack, logDebugCombatResult };
