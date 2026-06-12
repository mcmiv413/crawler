import { useEffect, useRef } from 'react';
import type {
  AnimatedEvent,
  BumpAnimationEntry,
  CombatIndicatorEntry,
  AbilityAnimationEntry,
  MoveAnimationEntry,
  ConsumableAnimationEntry,
} from '@dungeon/presenter';
import { isBeatSchedulerEnabledFlag } from '../config/feature-flags.js';
import { dispatchAnimatedEvent } from './dispatchAnimatedEvent.js';
import { useBeatAnimationOrchestrator } from './useAnimationOrchestrator.beat.js';

function isSameAnimationData(
  a: BumpAnimationEntry | CombatIndicatorEntry | MoveAnimationEntry | ConsumableAnimationEntry | AbilityAnimationEntry | { durationMs: number } | { entityId: string; durationMs: number; position?: { readonly x: number; readonly y: number } },
  b: BumpAnimationEntry | CombatIndicatorEntry | MoveAnimationEntry | ConsumableAnimationEntry | AbilityAnimationEntry | { durationMs: number } | { entityId: string; durationMs: number; position?: { readonly x: number; readonly y: number } },
): boolean {
  if ('effect' in a && 'effect' in b) {
    const ca = a as ConsumableAnimationEntry;
    const cb = b as ConsumableAnimationEntry;
    return (
      ca.effect === cb.effect
      && ca.playerPos.x === cb.playerPos.x
      && ca.playerPos.y === cb.playerPos.y
    );
  }

  if ('abilityId' in a && 'abilityId' in b) {
    const aa = a as AbilityAnimationEntry;
    const ab = b as AbilityAnimationEntry;
    return (
      aa.abilityId === ab.abilityId
      && aa.playerPos.x === ab.playerPos.x
      && aa.playerPos.y === ab.playerPos.y
      && aa.durationMs === ab.durationMs
      && aa.impactFrameMs === ab.impactFrameMs
    );
  }

  if ('entityId' in a && !('durationMs' in a) && 'entityId' in b && !('durationMs' in b)) {
    const ma = a as MoveAnimationEntry;
    const mb = b as MoveAnimationEntry;
    return (
      ma.entityId === mb.entityId
      && ma.fromPos.x === mb.fromPos.x
      && ma.fromPos.y === mb.fromPos.y
      && ma.toPos.x === mb.toPos.x
      && ma.toPos.y === mb.toPos.y
    );
  }

  if ('attackerId' in a && 'attackerId' in b) {
    const ba = a as BumpAnimationEntry;
    const bb = b as BumpAnimationEntry;
    return (
      ba.attackerId === bb.attackerId
      && ba.defenderId === bb.defenderId
      && ba.attackerPos.x === bb.attackerPos.x
      && ba.attackerPos.y === bb.attackerPos.y
      && ba.defenderPos.x === bb.defenderPos.x
      && ba.defenderPos.y === bb.defenderPos.y
      && ba.durationMs === bb.durationMs
      && ba.impactFrameMs === bb.impactFrameMs
    );
  }

  if ('text' in a && 'text' in b) {
    const ia = a as CombatIndicatorEntry;
    const ib = b as CombatIndicatorEntry;
    return (
      ia.x === ib.x
      && ia.y === ib.y
      && ia.text === ib.text
      && ia.type === ib.type
    );
  }

  if ('durationMs' in a && !('entityId' in a) && 'durationMs' in b && !('entityId' in b)) {
    return (a as { durationMs: number }).durationMs === (b as { durationMs: number }).durationMs;
  }

  if ('entityId' in a && 'durationMs' in a && 'entityId' in b && 'durationMs' in b) {
    const da = a as { entityId: string; durationMs: number; position?: { readonly x: number; readonly y: number } };
    const db = b as { entityId: string; durationMs: number; position?: { readonly x: number; readonly y: number } };
    return da.entityId === db.entityId
      && da.durationMs === db.durationMs
      && da.position?.x === db.position?.x
      && da.position?.y === db.position?.y;
  }

  return false;
}

// Prefer the beat scheduler for active runtime behavior. Keep this timeout path
// only as temporary compatibility until parity coverage lets us remove it.
function useLegacyAnimationOrchestrator(
  animatedEvents: readonly AnimatedEvent[],
  enabled: boolean,
): void {
  const previousRef = useRef<readonly AnimatedEvent[]>([]);
  const mutableTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const previous = previousRef.current;
    const mutableTimeouts = mutableTimeoutsRef.current;

    for (const timeout of mutableTimeouts) {
      clearTimeout(timeout);
    }
    mutableTimeouts.length = 0;

    if (!enabled) {
      previousRef.current = [];
      return () => {
        for (const timeout of mutableTimeouts) {
          clearTimeout(timeout);
        }
        mutableTimeouts.length = 0;
      };
    }

    for (const animEvent of animatedEvents) {
      const wasAlreadyEmitted = previous.some(
        (previousEvent) =>
          previousEvent.batchId === animEvent.batchId
          && previousEvent.type === animEvent.type
          && previousEvent.sequenceIndex === animEvent.sequenceIndex
          && previousEvent.delayMs === animEvent.delayMs
          && isSameAnimationData(previousEvent.data, animEvent.data),
      );

      if (!wasAlreadyEmitted) {
        const timeout = setTimeout(() => {
          dispatchAnimatedEvent(animEvent);
        }, animEvent.delayMs);

        mutableTimeouts.push(timeout);
      }
    }

    previousRef.current = animatedEvents;

    return () => {
      for (const timeout of mutableTimeouts) {
        clearTimeout(timeout);
      }
      mutableTimeouts.length = 0;
    };
  }, [animatedEvents, enabled]);
}

export function useAnimationOrchestrator(animatedEvents: readonly AnimatedEvent[]): void {
  const beatSchedulerEnabled = isBeatSchedulerEnabledFlag();

  useBeatAnimationOrchestrator(animatedEvents, beatSchedulerEnabled);
  useLegacyAnimationOrchestrator(animatedEvents, !beatSchedulerEnabled);
}
