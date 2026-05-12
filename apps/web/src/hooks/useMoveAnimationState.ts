import { useState, useEffect, useRef } from 'react';
import type { MoveAnimationEntry } from '@dungeon/presenter';

interface ActiveMoveAnimation extends MoveAnimationEntry {
  id: string;
  startTime: number;
  progress: number;
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

  useEffect(() => {
    const mutableTimers = mutableTimersRef.current;
    const handleMoveAnimation = (event: Event) => {
      const customEvent = event as CustomEvent<MoveAnimationEntry>;
      const entry = customEvent.detail;
      const now = Date.now();

      const animation: ActiveMoveAnimation = {
        id: `move-${nextIdRef.current++}`,
        ...entry,
        startTime: now,
        progress: 0,
      };

      setAnimations((prev) => {
        // If this entity already has a move animation in flight, replace it so
        // rapid auto-walk doesn't queue up stacked animations.
        const filtered = prev.filter((a) => a.entityId !== entry.entityId);
        return [...filtered, animation];
      });

      // Schedule removal after the style-specific duration
      const timer = setTimeout(() => {
        setAnimations((prev) => prev.filter((a) => a.id !== animation.id));
      }, entry.durationMs);

      mutableTimers.push(timer);
    };

    window.addEventListener('move-animation', handleMoveAnimation);
    return () => {
      window.removeEventListener('move-animation', handleMoveAnimation);
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
