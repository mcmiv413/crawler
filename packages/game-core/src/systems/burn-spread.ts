import type { DomainEvent, EnemyInstance, GameState } from '@dungeon/contracts';
import { MAGIC, STATUS_DEFAULTS } from '@dungeon/content';
import { chebyshevDistance } from '../utils/grid.js';
import type { SeededRNG } from '../utils/rng.js';
import {
  canFireMasteryPanicOnSpread,
  getFireBurnDuration,
  getFireBurnMagnitude,
  getFireBurnSpreadRadius,
} from './magic-xp.js';

export function spreadBurnFromDeadEnemy(
  state: GameState,
  deadEnemy: EnemyInstance,
  rng: SeededRNG,
): { enemies: ReadonlyMap<string, EnemyInstance>; events: DomainEvent[] } {
  if (state.run === null) return { enemies: new Map(), events: [] };

  // Check if dead enemy had burn status
  const hadBurn = deadEnemy.statuses.some(s => s.id === 'burn');
  if (hadBurn === false) return { enemies: state.run.enemies, events: [] };

  let updatedEnemies = new Map(state.run.enemies);
  let events: DomainEvent[] = [];
  const deadPos = deadEnemy.position;
  const spreadRadius = getFireBurnSpreadRadius(state.player);
  const burnDuration = getFireBurnDuration(state.player, STATUS_DEFAULTS.burn.defaultDuration);
  const burnMagnitude = getFireBurnMagnitude(state.player);

  // Find nearby living enemies (not the player, not the dead enemy)
  for (const [key, enemy] of updatedEnemies.entries()) {
    if (enemy.id === deadEnemy.id) continue;
    if (chebyshevDistance(enemy.position, deadPos) > spreadRadius) continue;
    if (rng.chance(MAGIC.burnSpreadChancePct) === false) continue;

    // Apply burn to nearby enemy
    const mutableStatuses = [...enemy.statuses];
    const existingBurn = mutableStatuses.find(s => s.id === 'burn');
    if (existingBurn === undefined) {
      const burn = {
        id: 'burn' as const,
        turnsRemaining: burnDuration,
        magnitude: burnMagnitude,
        sourceId: state.player.id,
      };
      mutableStatuses.push(burn);
      events = [...events, {
        type: 'STATUS_APPLIED',
        targetId: enemy.id,
        statusId: 'burn',
        duration: burnDuration,
        sourceId: state.player.id,
        timestamp: state.turnNumber,
        turnNumber: state.turnNumber,
      }];
    }

    if (canFireMasteryPanicOnSpread(state.player) === true && rng.chance(MAGIC.panicOnBurnSpreadChancePct) === true) {
      const existingPanic = mutableStatuses.find(s => s.id === 'panic');
      if (existingPanic === undefined) {
        mutableStatuses.push({
          id: 'panic',
          turnsRemaining: STATUS_DEFAULTS.panic.defaultDuration,
          magnitude: 1,
          sourceId: state.player.id,
        });
        events = [...events, {
          type: 'STATUS_APPLIED',
          targetId: enemy.id,
          statusId: 'panic',
          duration: STATUS_DEFAULTS.panic.defaultDuration,
          sourceId: state.player.id,
          timestamp: state.turnNumber,
          turnNumber: state.turnNumber,
        }];
      }
    }

    updatedEnemies.set(key, { ...enemy, statuses: mutableStatuses });
  }

  return { enemies: updatedEnemies, events };
}
