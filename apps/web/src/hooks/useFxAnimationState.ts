import { useState, useEffect, useRef } from 'react';
import type { AbilityAnimationEntry } from '@dungeon/presenter';

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
export function useFxAnimationState(): UseFxAnimationStateReturn {
  const [animations, setAnimations] = useState<ActiveFxAnimation[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const nextIdRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const handleAbilityAnimation = (event: Event) => {
      const customEvent = event as CustomEvent<AbilityAnimationEntry>;
      const data = customEvent.detail;
      const now = Date.now();

      const animation: ActiveFxAnimation = {
        id: `fx-${nextIdRef.current++}`,
        ...data,
        startTime: now,
        progress: 0,
      };

      setAnimations((prev) => [...prev, animation]);

      // Schedule removal after animation duration
      const timer = setTimeout(() => {
        setAnimations((prev) => prev.filter((a) => a.id !== animation.id));
      }, animation.durationMs + 50);

      timersRef.current.push(timer);
    };

    window.addEventListener('ability-animation', handleAbilityAnimation);
    return () => {
      window.removeEventListener('ability-animation', handleAbilityAnimation);
      const timers = timersRef.current;
      timers.forEach((t) => clearTimeout(t));
      timersRef.current = [];
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

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
