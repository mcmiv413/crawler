import type { DomainEvent } from '@dungeon/contracts';
import { burn } from '@dungeon/content';
import type { AbilityContext, StatusEffect } from '../types.js';
import { applyStatusToEnemy, applyStatusToPlayer } from '../../systems/status-effects.js';
import { getFireBurnDuration, getFireBurnMagnitude } from '../../systems/magic-xp.js';

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

  const statusId = effect.statusId;
  const baseDuration = effect.duration ?? 3;
  const duration = statusId === burn.id ? getFireBurnDuration(context.player, baseDuration) : baseDuration;
  const magnitude = statusId === burn.id ? getFireBurnMagnitude(context.player) : (effect.magnitude ?? 1);

  if (effect.target === 'player') {
    const updatedPlayer = applyStatusToPlayer(newState.player, statusId, duration, magnitude, context.player.id);
    return {
      state: { ...newState, player: updatedPlayer },
      events: [{
        type: 'STATUS_APPLIED',
        targetId: newState.player.id,
        statusId,
        duration,
        sourceId: context.player.id,
        timestamp: context.state.turnNumber,
        turnNumber: context.state.turnNumber,
      }],
    };
  }

  // Apply the status to the target
  if (newState.run === null) {
    return { state: newState, events };
  }

  const target = newState.run.enemies.get(targetKey);
  if (target === undefined) {
    return { state: newState, events };
  }

  const statusedEnemy = applyStatusToEnemy(target, statusId, duration, magnitude, context.player.id);

  const mutableEvents = [...events];
  const currentRun = newState.run;
  const newEnemies = new Map(currentRun.enemies);
  newEnemies.set(targetKey, statusedEnemy);
  newState = { ...newState, run: { ...currentRun, enemies: newEnemies } };

  mutableEvents.push({
    type: 'STATUS_APPLIED',
    targetId: target.id,
    statusId,
    duration,
    sourceId: context.player.id,
    timestamp: context.state.turnNumber,
    turnNumber: context.state.turnNumber,
  });

  return { state: newState, events: mutableEvents };
}
