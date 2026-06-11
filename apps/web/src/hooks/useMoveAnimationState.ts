import { useState, useEffect, useRef } from 'react';
import type { MoveAnimationEntry } from '@dungeon/presenter';
import {
  STEP_WALK_EXIT_PROGRESS,
  type WalkMotionPhase,
  getMoveTravelOffsetPx,
} from '../animations/move-style-profiles.js';
import {
  WALK_CONTINUATION_EVENT,
  type WalkContinuationDetail,
} from '../animation-runtime/walk-continuation-bus.js';
import { CELL_SIZE } from '../config/ui-config.js';

export interface ActiveMoveAnimation extends MoveAnimationEntry {
  id: string;
  startTime: number;
  progress: number;
  fromOffsetPx: { readonly x: number; readonly y: number };
  walkPhase: WalkMotionPhase;
}

interface UseMoveAnimationStateReturn {
  animations: ActiveMoveAnimation[];
}

type MoveAnimationSubscriber = (entry: MoveAnimationEntry) => void;

interface MoveAnimationSubscription {
  readonly subscriber: MoveAnimationSubscriber;
  active: boolean;
  refCount: number;
}

const moveAnimationSubscribers = new Set<MoveAnimationSubscription>();
const moveAnimationSubscriptionBySubscriber = new WeakMap<
  MoveAnimationSubscriber,
  MoveAnimationSubscription
>();

export function registerMoveAnimation(entry: MoveAnimationEntry): void {
  for (const subscription of [...moveAnimationSubscribers]) {
    if (!subscription.active || !moveAnimationSubscribers.has(subscription)) {
      continue;
    }
    subscription.subscriber(entry);
  }
}

export function subscribeMoveAnimation(subscriber: MoveAnimationSubscriber): () => void {
  const existingSubscription = moveAnimationSubscriptionBySubscriber.get(subscriber);
  if (existingSubscription?.active === true) {
    existingSubscription.refCount += 1;
    return () => {
      unsubscribeMoveAnimation(existingSubscription);
    };
  }

  const subscription: MoveAnimationSubscription = {
    subscriber,
    active: true,
    refCount: 1,
  };
  moveAnimationSubscriptionBySubscriber.set(subscriber, subscription);
  moveAnimationSubscribers.add(subscription);
  return () => {
    unsubscribeMoveAnimation(subscription);
  };
}

export function clearMoveAnimationSubscribers(): void {
  for (const subscription of moveAnimationSubscribers) {
    subscription.active = false;
    subscription.refCount = 0;
  }
  moveAnimationSubscribers.clear();
}

function unsubscribeMoveAnimation(subscription: MoveAnimationSubscription): void {
  if (!subscription.active) {
    return;
  }

  subscription.refCount -= 1;
  if (subscription.refCount > 0) {
    return;
  }

  subscription.active = false;
  moveAnimationSubscribers.delete(subscription);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearMoveAnimationSubscribers();
  });
}

/**
 * Hook to track active move animations with progress (0→1).
 * Listens for 'move-animation' events and maintains animation state.
 * Used by canvas renderer to smoothly slide entities between tiles.
 *
 * Duration is per-animation (stored on the entry as durationMs) so each
 * movement style can have its own timing.
 */
export function useMoveAnimationState(): UseMoveAnimationStateReturn {
  const [animations, setAnimations] = useState<ActiveMoveAnimation[]>([]);
  const nextIdRef = useRef(0);
  const mutableTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const continuationByEntityRef = useRef(new Map<string, boolean>());

  useEffect(() => {
    const mutableTimers = mutableTimersRef.current;
    const handleMoveAnimationEntry = (entry: MoveAnimationEntry) => {
      const now = Date.now();
      const id = `move-${nextIdRef.current++}`;

      setAnimations((prev) => {
        const prior = prev.find((a) => a.entityId === entry.entityId);
        if (prior !== undefined && isDuplicateMove(prior, entry, now)) {
          return prev;
        }

        const priorProgress = prior === undefined ? 1 : getAnimationProgress(prior, now);
        const carryingMomentum = prior !== undefined && priorProgress < 1;
        const fromOffsetPx = carryingMomentum
          ? getMoveTravelOffsetPx({ ...prior, progress: priorProgress }, CELL_SIZE)
          : { x: 0, y: 0 };
        const walkPhase = resolveWalkPhase(
          carryingMomentum,
          continuationByEntityRef.current.get(entry.entityId) === true,
        );

        const animation: ActiveMoveAnimation = {
          id,
          ...entry,
          fromOffsetPx,
          walkPhase,
          startTime: now,
          progress: 0,
        };

        // Keep only one active move per entity while preserving the rendered
        // takeover position in fromOffsetPx.
        const filtered = prev.filter((a) => a.entityId !== entry.entityId);
        return [...filtered, animation];
      });

      // Schedule removal after the style-specific duration
      const timer = setTimeout(() => {
        setAnimations((prev) => prev.filter((a) => a.id !== id));
      }, entry.durationMs);

      mutableTimers.push(timer);
    };

    const unsubscribeMoveAnimation = subscribeMoveAnimation(handleMoveAnimationEntry);
    const handleMoveAnimation = (event: Event) => {
      const customEvent = event as CustomEvent<MoveAnimationEntry>;
      registerMoveAnimation(customEvent.detail);
    };

    const handleWalkContinuation = (event: Event) => {
      const customEvent = event as CustomEvent<WalkContinuationDetail>;
      const detail = customEvent.detail;
      continuationByEntityRef.current.set(detail.entityId, detail.continuing);

      const now = Date.now();
      setAnimations((prev) =>
        prev.map((animation) => {
          if (animation.entityId !== detail.entityId || animation.style !== 'step') {
            return animation;
          }

          const progress = getAnimationProgress(animation, now);
          if (progress >= STEP_WALK_EXIT_PROGRESS) {
            return animation;
          }

          return {
            ...animation,
            progress,
            walkPhase: resolveWalkPhase(hasWalkMomentum(animation.walkPhase), detail.continuing),
          };
        }),
      );
    };

    window.addEventListener('move-animation', handleMoveAnimation);
    window.addEventListener(WALK_CONTINUATION_EVENT, handleWalkContinuation);
    return () => {
      window.removeEventListener('move-animation', handleMoveAnimation);
      window.removeEventListener(WALK_CONTINUATION_EVENT, handleWalkContinuation);
      unsubscribeMoveAnimation();
      mutableTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return { animations };
}

export function getAnimationProgress(animation: ActiveMoveAnimation, now: number): number {
  if (typeof animation.startTime !== 'number' || Number.isFinite(animation.startTime) === false) {
    return Math.min(Math.max(animation.progress, 0), 1);
  }
  if (animation.durationMs <= 0) return 1;
  return Math.min(Math.max((now - animation.startTime) / animation.durationMs, 0), 1);
}

export function resolveMoveAnimationProgress(
  animation: ActiveMoveAnimation,
  now: number,
): ActiveMoveAnimation {
  const progress = getAnimationProgress(animation, now);
  return progress === animation.progress
    ? animation
    : { ...animation, progress };
}

function isDuplicateMove(
  prior: ActiveMoveAnimation,
  entry: MoveAnimationEntry,
  now: number,
): boolean {
  return getAnimationProgress(prior, now) < 1
    && prior.fromPos.x === entry.fromPos.x
    && prior.fromPos.y === entry.fromPos.y
    && prior.toPos.x === entry.toPos.x
    && prior.toPos.y === entry.toPos.y
    && prior.style === entry.style
    && prior.durationMs === entry.durationMs;
}

function hasWalkMomentum(walkPhase: WalkMotionPhase): boolean {
  return walkPhase === 'middle' || walkPhase === 'end';
}

function resolveWalkPhase(carryingMomentum: boolean, continuing: boolean): WalkMotionPhase {
  if (continuing) {
    return carryingMomentum ? 'middle' : 'start';
  }
  return carryingMomentum ? 'end' : 'single';
}
