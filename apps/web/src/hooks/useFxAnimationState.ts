import { useState, useEffect, useRef } from 'react';
import type { AbilityAnimationEntry, AnimatedEvent } from '@dungeon/presenter';

interface ActiveFxAnimation extends AbilityAnimationEntry {
  id: string;
  startTime: number;
  progress: number;
}

interface UseFxAnimationStateReturn {
  animations: ActiveFxAnimation[];
}

/**
 * Hook to track active ability FX animations with progress (0→1).
 * Listens for animated events from the game view and maintains animation state.
 * Used by canvas renderer to draw ability visual effects.
 */
export function useFxAnimationState(
  animatedEvents: readonly AnimatedEvent[],
): UseFxAnimationStateReturn {
  const [animations, setAnimations] = useState<ActiveFxAnimation[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const nextIdRef = useRef(0);
  const seenBatchIdsRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const now = Date.now();

    // Process new animation events
    const newAnimations: ActiveFxAnimation[] = [];
    for (const event of animatedEvents) {
      if (event.type !== 'ability') continue;

      const data = event.data as AbilityAnimationEntry;
      // Skip if animation ID is invalid

      // Skip if we've already seen this batch
      if (seenBatchIdsRef.current.has(event.batchId)) continue;
      seenBatchIdsRef.current.add(event.batchId);

      const animation: ActiveFxAnimation = {
        id: `fx-${nextIdRef.current++}`,
        ...data,
        startTime: now + event.delayMs,
        progress: 0,
      };

      newAnimations.push(animation);

      // Schedule removal after animation duration
      const timer = setTimeout(() => {
        setAnimations((prev) => prev.filter((a) => a.id !== animation.id));
      }, event.delayMs + animation.durationMs + 50);

      timersRef.current.push(timer);
    }

    if (newAnimations.length > 0) {
      setAnimations((prev) => [...prev, ...newAnimations]);
    }

    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [animatedEvents]);

  // Update progress values on every frame
  useEffect(() => {
    const updateProgress = () => {
      setAnimations((prev) =>
        prev
          .map((anim) => {
            const elapsed = Date.now() - anim.startTime;
            if (elapsed < 0) {
              return { ...anim, progress: 0 };
            }
            const progress = Math.min(elapsed / anim.durationMs, 1);
            return { ...anim, progress };
          })
          .filter((anim) => anim.progress < 1),
      );

      rafRef.current = requestAnimationFrame(updateProgress);
    };

    rafRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return { animations };
}
