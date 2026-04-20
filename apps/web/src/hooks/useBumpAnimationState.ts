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

/**
 * Hook to track active bump animations with progress (0→1).
 * Listens for 'bump-animation' events and maintains animation state.
 * Used by canvas renderer to offset entity positions during attacks.
 */
export function useBumpAnimationState(duration: number): UseBumpAnimationStateReturn {
  const [animations, setAnimations] = useState<ActiveBumpAnimation[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const nextIdRef = useRef(0);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    const handleBumpAnimation = (event: Event) => {
      const customEvent = event as CustomEvent<BumpAnimationEntry>;
      const now = Date.now();
      const animation: ActiveBumpAnimation = {
        id: `bump-${nextIdRef.current++}`,
        ...customEvent.detail,
        startTime: now,
        progress: 0,
      };

      setAnimations((prev) => [...prev, animation]);

      // Schedule removal after duration
      const timer = setTimeout(() => {
        setAnimations((prev) => prev.filter((a) => a.id !== animation.id));
      }, duration);

      timersRef.current.push(timer);
    };

    window.addEventListener('bump-animation', handleBumpAnimation);
    return () => {
      window.removeEventListener('bump-animation', handleBumpAnimation);
      timersRef.current.forEach((t) => clearTimeout(t));
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [duration]);

  // Update progress values on every frame
  useEffect(() => {
    const updateProgress = () => {
      setAnimations((prev) =>
        prev.map((anim) => {
          const elapsed = Date.now() - anim.startTime;
          const progress = Math.min(elapsed / duration, 1);
          return { ...anim, progress };
        })
      );

      rafRef.current = requestAnimationFrame(updateProgress);
    };

    rafRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [duration]);

  return { animations };
}
