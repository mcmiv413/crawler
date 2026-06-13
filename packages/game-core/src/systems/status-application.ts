import type { EnemyInstance, Player, StatusAppliedEvent, StatusId } from '@dungeon/contracts';
import { STATUS_DEFAULTS, burn } from '@dungeon/content';
import { applyStatusToEnemy } from './status-effects.js';
import { getFireBurnDuration, getFireBurnMagnitude } from './magic-xp.js';
import { buildStatusAppliedEvent } from '../abilities/runtime/emit-events.js';

/**
 * Central duration/magnitude rules for player-sourced status application.
 * Burn scales with the player's fire mastery; everything else keeps its base values.
 * This is the single source of truth shared by the ability path and weapon on-hit path.
 */
export function resolveStatusApplication(
  player: Player,
  statusId: StatusId,
  baseDuration: number,
  baseMagnitude = 1,
): { duration: number; magnitude: number } {
  if (statusId === burn.id) {
    return {
      duration: getFireBurnDuration(player, baseDuration),
      magnitude: getFireBurnMagnitude(player),
    };
  }
  return { duration: baseDuration, magnitude: baseMagnitude };
}

/** Default duration for a status when no explicit duration is provided. */
export function getStatusDefaultDuration(statusId: StatusId): number {
  const defaults = STATUS_DEFAULTS[statusId];
  return 'defaultDuration' in defaults ? (defaults as { defaultDuration: number }).defaultDuration : 3;
}

/**
 * Apply a player-sourced status (weapon on-hit, heat surge, etc.) to an enemy using the
 * central duration/magnitude rules and the central STATUS_APPLIED event factory.
 */
export function applyPlayerStatusToEnemy(
  enemy: EnemyInstance,
  statusId: StatusId,
  player: Player,
  turnNumber: number,
): { enemy: EnemyInstance; event: StatusAppliedEvent } {
  const { duration, magnitude } = resolveStatusApplication(player, statusId, getStatusDefaultDuration(statusId));
  const updatedEnemy = applyStatusToEnemy(enemy, statusId, duration, magnitude, player.id);
  const event = buildStatusAppliedEvent({
    targetId: enemy.id,
    statusId,
    duration,
    sourceId: player.id,
    turnNumber,
  });
  return { enemy: updatedEnemy, event };
}
