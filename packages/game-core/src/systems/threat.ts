import type { GameState } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';

/**
 * Check if the player is under immediate threat from enemies.
 * A player is threatened if any alerted enemy could legally attack the player.
 */
export function isPlayerThreatened(state: GameState): boolean {
  if (state.run === null || state.phase !== 'dungeon') {
    return false;
  }

  for (const enemy of state.run.enemies.values()) {
    // Only alerted enemies pose a threat
    if (enemy.isAlerted !== true) {
      continue;
    }

    // Dead enemies are not a threat
    if (enemy.stats.health <= 0) {
      continue;
    }

    // Check if enemy can reach the player
    const distance = chebyshevDistance(enemy.position, state.player.position);

    // Get weapon range from enemy equipment
    const weaponRange = enemy.equipment.weapon.weaponRange;

    // Enemy can attack if within or at range
    if (distance <= weaponRange) {
      return true;
    }
  }

  return false;
}
