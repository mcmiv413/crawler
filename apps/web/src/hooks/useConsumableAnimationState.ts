import { useState, useEffect, useRef } from 'react';
import type { ConsumableAnimationEntry } from '@dungeon/presenter';

export interface ActiveConsumableAnimation extends ConsumableAnimationEntry {
  id: string;
  startTime: number;
  progress: number;
}

interface UseConsumableAnimationStateReturn {
  animations: ActiveConsumableAnimation[];
}

/**
 * Hook to track active consumable-use animations with progress (0→1).
 * Listens for 'consumable-animation' events dispatched by emitConsumableAnimation.
 * Used by canvas-renderer to draw heal/buff/cure/damage effects over the dungeon.
 *
 * Duration is per-animation (entry.durationMs) so each effect has its own timing.
 */
export function useConsumableAnimationState(): UseConsumableAnimationStateReturn {
  const [animations, setAnimations] = useState<ActiveConsumableAnimation[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const nextIdRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const handleConsumableAnimation = (event: Event) => {
      const customEvent = event as CustomEvent<ConsumableAnimationEntry>;
      const entry = customEvent.detail;
      const now = Date.now();

      const animation: ActiveConsumableAnimation = {
        id: `consumable-${nextIdRef.current++}`,
        ...entry,
        startTime: now,
        progress: 0,
      };

      setAnimations((prev) => [...prev, animation]);

      // Schedule removal once the full duration has elapsed
      const timer = setTimeout(() => {
        setAnimations((prev) => prev.filter((a) => a.id !== animation.id));
      }, entry.durationMs);

      timersRef.current.push(timer);
    };

    window.addEventListener('consumable-animation', handleConsumableAnimation);
    return () => {
      window.removeEventListener('consumable-animation', handleConsumableAnimation);
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Drive progress 0→1 on every animation frame
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
