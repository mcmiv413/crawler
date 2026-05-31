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

interface ActiveMoveAnimation extends MoveAnimationEntry {
  id: string;
  startTime: number;
  progress: number;
  fromOffsetPx: { readonly x: number; readonly y: number };
  walkPhase: WalkMotionPhase;
}

interface UseMoveAnimationStateReturn {
  animations: ActiveMoveAnimation[];
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
  const rafRef = useRef<number | undefined>(undefined);
  const nextIdRef = useRef(0);
  const mutableTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const continuationByEntityRef = useRef(new Map<string, boolean>());

  useEffect(() => {
    const mutableTimers = mutableTimersRef.current;
    const handleMoveAnimation = (event: Event) => {
      const customEvent = event as CustomEvent<MoveAnimationEntry>;
      const entry = customEvent.detail;
      const now = Date.now();
      const id = `move-${nextIdRef.current++}`;

      setAnimations((prev) => {
        const prior = prev.find((a) => a.entityId === entry.entityId);
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
      mutableTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Drive progress on every frame
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setAnimations((prev) =>
        prev.map((anim) => {
          const elapsed = now - anim.startTime;
          const progress = Math.min(elapsed / anim.durationMs, 1);
          return { ...anim, progress };
        }),
      );
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { animations };
}

function getAnimationProgress(animation: ActiveMoveAnimation, now: number): number {
  if (animation.durationMs <= 0) return 1;
  return Math.min(Math.max((now - animation.startTime) / animation.durationMs, 0), 1);
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
