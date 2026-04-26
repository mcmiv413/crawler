import { useEffect, useRef } from 'react';
import type { AnimatedEvent, BumpAnimationEntry, CombatIndicatorEntry, MoveAnimationEntry } from '@dungeon/presenter';
import { emitBumpAnimation, emitMoveAnimation } from '../components/BumpAnimations.js';
import { emitCombatIndicator } from '../components/CombatIndicators.js';

/**
 * Central orchestrator for all combat and movement animations.
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
  a: BumpAnimationEntry | CombatIndicatorEntry | MoveAnimationEntry,
  b: BumpAnimationEntry | CombatIndicatorEntry | MoveAnimationEntry,
): boolean {
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
      ba.attackerId     === bb.attackerId &&
      ba.defenderId     === bb.defenderId &&
      ba.attackerPos.x  === bb.attackerPos.x &&
      ba.attackerPos.y  === bb.attackerPos.y &&
      ba.defenderPos.x  === bb.defenderPos.x &&
      ba.defenderPos.y  === bb.defenderPos.y
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

  return false;
}
