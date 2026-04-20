import { useEffect, useRef } from 'react';
import type { AnimatedEvent, BumpAnimationEntry, CombatIndicatorEntry } from '@dungeon/presenter';
import { emitBumpAnimation } from '../components/BumpAnimations.js';
import { emitCombatIndicator } from '../components/CombatIndicators.js';

/**
 * Central orchestrator for all combat animations.
 * Takes sequenced animation events from the presenter and emits them
 * at the correct times to create a fluid, turn-based animation sequence.
 */
export function useAnimationOrchestrator(animatedEvents: readonly AnimatedEvent[]): void {
  const previousRef = useRef<readonly AnimatedEvent[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    const previous = previousRef.current;

    // Clear any pending timeouts from previous render
    for (const timeout of timeoutsRef.current) {
      clearTimeout(timeout);
    }
    timeoutsRef.current = [];

    // Emit events new or different from the previous array
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
        // Schedule the emission at the correct delay
        const timeout = setTimeout(() => {
          if (animEvent.type === 'bump') {
            emitBumpAnimation(animEvent.data as BumpAnimationEntry);
          } else if (animEvent.type === 'damage' || animEvent.type === 'heal' || animEvent.type === 'status') {
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

    // Cleanup on unmount or dependency change
    return () => {
      for (const timeout of timeoutsRef.current) {
        clearTimeout(timeout);
      }
      timeoutsRef.current = [];
    };
  }, [animatedEvents]);
}

function isSameAnimationData(
  a: BumpAnimationEntry | CombatIndicatorEntry,
  b: BumpAnimationEntry | CombatIndicatorEntry,
): boolean {
  // Check if both are BumpAnimationEntry
  if ('attackerId' in a && 'attackerId' in b) {
    const bumpa = a as BumpAnimationEntry;
    const bumpb = b as BumpAnimationEntry;
    return (
      bumpa.attackerId === bumpb.attackerId &&
      bumpa.defenderId === bumpb.defenderId &&
      bumpa.attackerPos.x === bumpb.attackerPos.x &&
      bumpa.attackerPos.y === bumpb.attackerPos.y &&
      bumpa.defenderPos.x === bumpb.defenderPos.x &&
      bumpa.defenderPos.y === bumpb.defenderPos.y
    );
  }

  // Both are CombatIndicatorEntry
  if ('text' in a && 'text' in b) {
    const indica = a as CombatIndicatorEntry;
    const indicb = b as CombatIndicatorEntry;
    return (
      indica.x === indicb.x &&
      indica.y === indicb.y &&
      indica.text === indicb.text &&
      indica.type === indicb.type
    );
  }

  return false;
}
