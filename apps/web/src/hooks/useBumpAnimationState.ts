import { useState, useEffect, useRef } from 'react';
import type { BumpAnimationEntry } from '@dungeon/presenter';

interface ActiveBumpAnimation extends BumpAnimationEntry {
  id: string;
  startTime: number;
  progress: number;
}

interface UseBumpAnimationStateReturn {
  animations: ActiveBumpAnimation[];
}

type LegacyBumpAnimationEntry = Omit<BumpAnimationEntry, 'durationMs' | 'impactFrameMs'> &
  Partial<Pick<BumpAnimationEntry, 'durationMs' | 'impactFrameMs'>>;

/**
 * Hook to track active bump animations with progress (0→1).
 * Listens for 'bump-animation' events and maintains animation state.
 * Used by canvas renderer to offset entity positions during attacks.
 */
const LEGACY_BUMP_DURATION_MS = 300;

export function useBumpAnimationState(duration?: number): UseBumpAnimationStateReturn {
  const [animations, setAnimations] = useState<ActiveBumpAnimation[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const nextIdRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fallbackDurationMs = duration ?? LEGACY_BUMP_DURATION_MS;

  useEffect(() => {
    const timers = timersRef.current;
    const handleBumpAnimation = (event: Event) => {
      const customEvent = event as CustomEvent<LegacyBumpAnimationEntry>;
      const now = Date.now();
      const durationMs = customEvent.detail.durationMs ?? fallbackDurationMs;
      const impactFrameMs = customEvent.detail.impactFrameMs ?? Math.floor(durationMs * 0.5);
      const animation: ActiveBumpAnimation = {
        id: `bump-${nextIdRef.current++}`,
        ...customEvent.detail,
        durationMs,
        impactFrameMs,
        startTime: now,
        progress: 0,
      };

      setAnimations((prev) => [...prev, animation]);

      // Schedule removal after duration
      const timer = setTimeout(() => {
        setAnimations((prev) => prev.filter((a) => a.id !== animation.id));
      }, animation.durationMs);

      timers.push(timer);
    };

    window.addEventListener('bump-animation', handleBumpAnimation);
    return () => {
      window.removeEventListener('bump-animation', handleBumpAnimation);
      timers.forEach((t) => clearTimeout(t));
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [fallbackDurationMs]);

  // Update progress values on every frame
  useEffect(() => {
    if (animations.length === 0) {
      return;
    }

    const updateProgress = () => {
      rafRef.current = undefined;
      setAnimations((prev) =>
        prev.length === 0
          ? prev
          : prev.map((anim) => {
              const elapsed = Date.now() - anim.startTime;
              const progress = Math.min(elapsed / anim.durationMs, 1);
              return { ...anim, progress };
            })
      );
    };

    rafRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
    };
  }, [animations]);

  return { animations };
}
