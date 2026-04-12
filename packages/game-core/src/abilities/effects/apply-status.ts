import type { DomainEvent, StatusId } from '@dungeon/contracts';
import type { AbilityContext, StatusEffect } from '../types.js';
import { applyStatusToEnemy } from '../../systems/status-effects.js';

/**
 * Apply a status effect to a target.
 */
export function applyStatus(
  context: AbilityContext,
  effect: StatusEffect,
  targetKey: string,
  didHit: boolean,
): { state: typeof context.state; events: readonly DomainEvent[] } {
  let newState = context.state;
  const events: DomainEvent[] = [];

  // Check trigger condition
  if (effect.trigger === 'on_hit' && !didHit) {
    return { state: newState, events };
  }

  // Roll for chance
  const chance = effect.chance ?? 1.0;
  if (context.rng.next() > chance) {
    return { state: newState, events };
  }

  // Apply the status to the target
  if (newState.run === null) {
    return { state: newState, events };
  }

  const target = newState.run.enemies.get(targetKey);
  if (target === undefined) {
    return { state: newState, events };
  }

  const statusId = effect.statusId as StatusId;
  const statusedEnemy = applyStatusToEnemy(target, statusId, effect.duration ?? 3, 2, context.player.id);

  const mutableEvents = [...events];
  const currentRun = newState.run;
  const newEnemies = new Map(currentRun.enemies);
  newEnemies.set(targetKey, statusedEnemy);
  newState = { ...newState, run: { ...currentRun, enemies: newEnemies } };

  mutableEvents.push({
    type: 'STATUS_APPLIED',
    targetId: target.id,
    statusId,
    duration: effect.duration ?? 3,
    sourceId: context.player.id,
    timestamp: Date.now(),
    turnNumber: context.state.turnNumber,
  });

  return { state: newState, events: mutableEvents };
}
