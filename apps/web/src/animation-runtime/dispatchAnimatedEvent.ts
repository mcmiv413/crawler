import type {
  AbilityAnimationEntry,
  AnimatedEvent,
  BumpAnimationEntry,
  CombatIndicatorEntry,
  ConsumableAnimationEntry,
  DefenderHitEntry,
  MoveAnimationEntry,
} from '@dungeon/presenter';
import {
  emitAbilityAnimation,
  emitBumpAnimation,
  emitCombatIndicator,
  emitConsumableAnimation,
  emitMoveAnimation,
} from './emitters.js';
import { triggerDefenderHit } from '../hooks/useDefenderHitState.js';
import { triggerHitStop } from '../hooks/useHitStop.js';

function isCombatIndicatorType(
  type: AnimatedEvent['type'],
): type is 'damage' | 'heal' | 'status' {
  return type === 'damage' || type === 'heal' || type === 'status';
}

export function dispatchAnimatedEvent(animEvent: AnimatedEvent): void {
  if (animEvent.type === 'bump') {
    emitBumpAnimation(animEvent.data as BumpAnimationEntry);
    return;
  }

  if (animEvent.type === 'move') {
    emitMoveAnimation(animEvent.data as MoveAnimationEntry);
    return;
  }

  if (animEvent.type === 'consumable') {
    emitConsumableAnimation(animEvent.data as ConsumableAnimationEntry);
    return;
  }

  if (animEvent.type === 'ability') {
    emitAbilityAnimation(animEvent.data as AbilityAnimationEntry);
    return;
  }

  if (animEvent.type === 'hit-stop') {
    const entry = animEvent.data as { durationMs: number };
    triggerHitStop(entry.durationMs);
    return;
  }

  if (animEvent.type === 'defender-hit') {
    const entry = animEvent.data as DefenderHitEntry;
    triggerDefenderHit(entry.entityId, entry.durationMs, entry.position);
    return;
  }

  if (isCombatIndicatorType(animEvent.type)) {
    emitCombatIndicator(
      (animEvent.data as CombatIndicatorEntry).x,
      (animEvent.data as CombatIndicatorEntry).y,
      (animEvent.data as CombatIndicatorEntry).text,
      animEvent.type,
    );
  }
}
