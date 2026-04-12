/**
 * Minimal type representation for auto-walk cancellation checks.
 * Used to avoid circular dependency between game-core and presenter.
 */
interface GameViewRef {
  readonly phase: string;
  readonly player: { readonly health: number };
  readonly map?: {
    readonly entities?: ReadonlyArray<{ readonly id: string; readonly type: string }>;
  };
}

/**
 * Pure function that determines whether auto-walk should be cancelled
 * based on game state changes between two views.
 *
 * Auto-walk is cancelled if:
 * 1. Phase changed (entered combat, town, or game over)
 * 2. Player health decreased (took damage)
 * 3. A new enemy/threat appeared that wasn't visible before
 *
 * This function can be used both in React hooks and in core engine logic.
 */
export function shouldCancelAutoWalk(prevView: GameViewRef, newView: GameViewRef): boolean {
  // Phase change (dungeon → combat, town, game_over)
  if (newView.phase !== 'dungeon') {
    return true;
  }

  // Player took damage
  const prevHealth = prevView.player.health;
  const newHealth = newView.player.health;
  if (newHealth < prevHealth) {
    return true;
  }

  // New threat appeared: compare enemy counts and IDs
  const prevEnemyIds = new Set(
    (prevView.map?.entities ?? [])
      .filter(e => e.type === 'enemy')
      .map(e => e.id),
  );

  const newEnemies = (newView.map?.entities ?? []).filter(e => e.type === 'enemy');
  for (const enemy of newEnemies) {
    if (!prevEnemyIds.has(enemy.id)) {
      // New enemy appeared
      return true;
    }
  }

  return false;
}
