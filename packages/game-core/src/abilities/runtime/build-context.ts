import type { GameState, EntityId, EnemyInstance, Direction } from '@dungeon/contracts';
import type { SeededRNG } from '../../utils/rng.js';
import type { AbilityContext } from '../types.js';

/**
 * Build an ability context from game state and optional target.
 * Does not execute anything; just prepares the context for the runtime.
 */
export function buildContext(
  state: GameState,
  rng: SeededRNG,
  targetId?: EntityId,
  direction?: Direction,
): AbilityContext {
  let target: { instance: EnemyInstance; key: string } | undefined;

  if (targetId !== undefined && state.run !== null) {
    for (const [key, enemy] of state.run.enemies) {
      if (enemy.id === targetId) {
        target = { instance: enemy, key };
        break;
      }
    }
  }

  return {
    state,
    rng,
    player: state.player,
    run: state.run,
    equippedWeaponId: state.player.equipment.weapon,
    direction,
    target,
  };
}
