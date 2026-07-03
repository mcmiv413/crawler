import type { DomainEvent, EnemyInstance, GameState } from '@dungeon/contracts';
import { MAGIC, STATUS_DEFAULTS, burn, panic } from '@dungeon/content';
import { chebyshevDistance } from '../utils/grid.js';
import type { SeededRNG } from '../utils/rng.js';
import { buildStatusAppliedEvent } from '../abilities/runtime/emit-events.js';
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
  const hadBurn = deadEnemy.statuses.some(s => s.id === burn.id);
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

    const existingBurn = enemy.statuses.find(s => s.id === burn.id);
    const burnStatus = {
      id: burn.id,
      turnsRemaining: burnDuration,
      magnitude: burnMagnitude,
      sourceId: state.player.id,
    };
    const statusesAfterBurn = [
      ...enemy.statuses,
      ...(existingBurn === undefined ? [burnStatus] : []),
    ];
    const shouldApplyPanic = canFireMasteryPanicOnSpread(state.player) === true
      && rng.chance(MAGIC.panicOnBurnSpreadChancePct) === true;
    const existingPanic = statusesAfterBurn.find(s => s.id === panic.id);
    const panicStatus = {
      id: panic.id,
      turnsRemaining: STATUS_DEFAULTS.panic.defaultDuration,
      magnitude: 1,
      sourceId: state.player.id,
    };
    const statuses = [
      ...statusesAfterBurn,
      ...(shouldApplyPanic === true && existingPanic === undefined ? [panicStatus] : []),
    ];

    events = [
      ...events,
      ...(existingBurn === undefined ? [buildStatusAppliedEvent({
        targetId: enemy.id,
        statusId: burn.id,
        duration: burnDuration,
        sourceId: state.player.id,
        turnNumber: state.turnNumber,
      })] : []),
      ...(shouldApplyPanic === true && existingPanic === undefined ? [buildStatusAppliedEvent({
          targetId: enemy.id,
          statusId: panic.id,
          duration: STATUS_DEFAULTS.panic.defaultDuration,
          sourceId: state.player.id,
          turnNumber: state.turnNumber,
      })] : []),
    ];

    updatedEnemies.set(key, { ...enemy, statuses });
  }

  return { enemies: updatedEnemies, events };
}
