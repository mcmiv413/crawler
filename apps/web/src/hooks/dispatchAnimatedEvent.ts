import type {
  AbilityAnimationEntry,
  AnimatedEvent,
  BumpAnimationEntry,
  CombatIndicatorEntry,
  ConsumableAnimationEntry,
  MoveAnimationEntry,
} from '@dungeon/presenter';
import type { EntityId } from '@dungeon/contracts';
import {
  emitAbilityAnimation,
  emitBumpAnimation,
  emitConsumableAnimation,
  emitMoveAnimation,
} from '../components/BumpAnimations.js';
import { emitCombatIndicator } from '../components/CombatIndicators.js';
import { triggerDefenderHit } from './useDefenderHitState.js';
import { triggerHitStop } from './useHitStop.js';

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
    const entry = animEvent.data as { entityId: string; durationMs: number };
    triggerDefenderHit(entry.entityId as EntityId, entry.durationMs);
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
