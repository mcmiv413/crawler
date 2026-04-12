import type { EnemyInstance, Player } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';

export enum SimulationFidelity {
  High = 'high', // close or recently acted
  Medium = 'medium', // nearby but not close
  Low = 'low', // distant, abstract
}

/**
 * Determine simulation fidelity for an enemy based on distance to player
 * High fidelity = full decision-making, Medium = reduced checks, Low = minimal updates
 */
export function getSimulationFidelity(
  enemy: EnemyInstance,
  player: Player,
): SimulationFidelity {
  const dist = chebyshevDistance(enemy.position, player.position);
  const recentlyActed = (enemy.ambientStateAge ?? 0) <= 1;

  // High fidelity: close to player or recently acted (within 5 tiles or acted last turn)
  if (dist <= 5 || recentlyActed) {
    return SimulationFidelity.High;
  }

  // Medium fidelity: nearby but not close (6-12 Chebyshev distance)
  if (dist >= 6 && dist <= 12) {
    return SimulationFidelity.Medium;
  }

  // Low fidelity: distant (> 12)
  return SimulationFidelity.Low;
}
