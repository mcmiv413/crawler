import { useEffect, useRef } from 'react';
import type {
  AnimatedEvent,
  BumpAnimationEntry,
  CombatIndicatorEntry,
  MoveAnimationEntry,
  ConsumableAnimationEntry,
  AbilityAnimationEntry,
} from '@dungeon/presenter';
import type { EntityId } from '@dungeon/contracts';
import { emitBumpAnimation, emitMoveAnimation, emitConsumableAnimation, emitAbilityAnimation } from '../components/BumpAnimations.js';
import { emitCombatIndicator } from '../components/CombatIndicators.js';
import { triggerDefenderHit } from './useDefenderHitState.js';
import { triggerHitStop } from './useHitStop.js';

/**
 * Central orchestrator for all combat, movement, and consumable animations.
 * Takes sequenced animation events from the presenter and emits them
 * at the correct times to create a fluid, turn-based animation sequence.
 */
export function useAnimationOrchestrator(animatedEvents: readonly AnimatedEvent[]): void {
  const previousRef = useRef<readonly AnimatedEvent[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const previous = previousRef.current;

    for (const timeout of timeoutsRef.current) {
      clearTimeout(timeout);
    }
    timeoutsRef.current = [];

    for (const animEvent of animatedEvents) {
      const wasAlreadyEmitted = previous.some(
        p =>
          p.batchId === animEvent.batchId &&
          p.type === animEvent.type &&
          p.sequenceIndex === animEvent.sequenceIndex &&
          p.delayMs === animEvent.delayMs &&
          isSameAnimationData(p.data, animEvent.data),
      );

      if (!wasAlreadyEmitted) {
        const timeout = setTimeout(() => {
          if (animEvent.type === 'bump') {
            emitBumpAnimation(animEvent.data as BumpAnimationEntry);
          } else if (animEvent.type === 'move') {
            emitMoveAnimation(animEvent.data as MoveAnimationEntry);
          } else if (animEvent.type === 'consumable') {
            emitConsumableAnimation(animEvent.data as ConsumableAnimationEntry);
          } else if (animEvent.type === 'ability') {
            emitAbilityAnimation(animEvent.data as AbilityAnimationEntry);
          } else if (animEvent.type === 'hit-stop') {
            const entry = animEvent.data as { durationMs: number };
            triggerHitStop(entry.durationMs);
          } else if (animEvent.type === 'defender-hit') {
            const entry = animEvent.data as { entityId: string; durationMs: number };
            triggerDefenderHit(entry.entityId as EntityId, entry.durationMs);
          } else if (
            animEvent.type === 'damage' ||
            animEvent.type === 'heal' ||
            animEvent.type === 'status'
          ) {
            emitCombatIndicator(
              (animEvent.data as CombatIndicatorEntry).x,
              (animEvent.data as CombatIndicatorEntry).y,
              (animEvent.data as CombatIndicatorEntry).text,
              animEvent.type as 'damage' | 'heal' | 'status' | 'gold',
            );
          }
        }, animEvent.delayMs);

        timeoutsRef.current.push(timeout);
      }
    }

    previousRef.current = animatedEvents;

    return () => {
      for (const timeout of timeoutsRef.current) {
        clearTimeout(timeout);
      }
      timeoutsRef.current = [];
    };
  }, [animatedEvents]);
}

function isSameAnimationData(
  a: BumpAnimationEntry | CombatIndicatorEntry | MoveAnimationEntry | ConsumableAnimationEntry | AbilityAnimationEntry | { durationMs: number } | { entityId: string; durationMs: number },
  b: BumpAnimationEntry | CombatIndicatorEntry | MoveAnimationEntry | ConsumableAnimationEntry | AbilityAnimationEntry | { durationMs: number } | { entityId: string; durationMs: number },
): boolean {
  // ConsumableAnimationEntry — has 'effect' field (check first; no overlap with other types)
  if ('effect' in a && 'effect' in b) {
    const ca = a as ConsumableAnimationEntry;
    const cb = b as ConsumableAnimationEntry;
    return (
      ca.effect      === cb.effect &&
      ca.playerPos.x === cb.playerPos.x &&
      ca.playerPos.y === cb.playerPos.y
    );
  }

  // AbilityAnimationEntry — has 'abilityId' field
  if ('abilityId' in a && 'abilityId' in b) {
    const aa = a as AbilityAnimationEntry;
    const ab = b as AbilityAnimationEntry;
    return (
      aa.abilityId    === ab.abilityId &&
      aa.playerPos.x === ab.playerPos.x &&
      aa.playerPos.y === ab.playerPos.y
    );
  }

  // MoveAnimationEntry — has entityId
  if ('entityId' in a && 'entityId' in b) {
    const ma = a as MoveAnimationEntry;
    const mb = b as MoveAnimationEntry;
    return (
      ma.entityId    === mb.entityId &&
      ma.fromPos.x   === mb.fromPos.x &&
      ma.fromPos.y   === mb.fromPos.y &&
      ma.toPos.x     === mb.toPos.x &&
      ma.toPos.y     === mb.toPos.y
    );
  }

  // BumpAnimationEntry — has attackerId
  if ('attackerId' in a && 'attackerId' in b) {
    const ba = a as BumpAnimationEntry;
    const bb = b as BumpAnimationEntry;
    return (
      ba.attackerId    === bb.attackerId &&
      ba.defenderId    === bb.defenderId &&
      ba.attackerPos.x === bb.attackerPos.x &&
      ba.attackerPos.y === bb.attackerPos.y &&
      ba.defenderPos.x === bb.defenderPos.x &&
      ba.defenderPos.y === bb.defenderPos.y
    );
  }

  // CombatIndicatorEntry — has text
  if ('text' in a && 'text' in b) {
    const ia = a as CombatIndicatorEntry;
    const ib = b as CombatIndicatorEntry;
    return (
      ia.x    === ib.x &&
      ia.y    === ib.y &&
      ia.text === ib.text &&
      ia.type === ib.type
    );
  }

  // HitStopEntry — has only durationMs
  if ('durationMs' in a && !('entityId' in a) && 'durationMs' in b && !('entityId' in b)) {
    const ha = a as { durationMs: number };
    const hb = b as { durationMs: number };
    return ha.durationMs === hb.durationMs;
  }

  // DefenderHitEntry — has entityId and durationMs
  if ('entityId' in a && 'durationMs' in a && 'entityId' in b && 'durationMs' in b) {
    const da = a as { entityId: string; durationMs: number };
    const db = b as { entityId: string; durationMs: number };
    return da.entityId === db.entityId && da.durationMs === db.durationMs;
  }

  return false;
}
