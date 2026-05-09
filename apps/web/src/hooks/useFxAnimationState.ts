import { useEffect, useRef, useState } from 'react';

export type ActiveFxAnimation<TEntry extends { readonly durationMs: number }> = TEntry & {
  id: string;
  startTime: number;
  progress: number;
};

/**
 * Generic FX animation hook factory.
 * Creates a hook that listens to CustomEvent on a specified channel,
 * tracks active animations with per-entry durationMs, and updates progress 0→1.
 *
 * Usage:
 *   export const useMyAnimationState = createFxHook<MyAnimationEntry>('my-channel');
 */
export function createFxHook<TEntry extends { readonly durationMs: number }>(channel: string) {
  return function useFxAnimation(): { animations: readonly ActiveFxAnimation<TEntry>[] } {
    const [animations, setAnimations] = useState<ActiveFxAnimation<TEntry>[]>([]);
    const rafRef = useRef<number | undefined>(undefined);
    const nextIdRef = useRef(0);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
      const handleAnimation = (event: Event) => {
        const customEvent = event as CustomEvent<TEntry>;
        const entry = customEvent.detail;
        const now = Date.now();

        const animation: ActiveFxAnimation<TEntry> = {
          ...entry,
          id: `${channel}-${nextIdRef.current++}`,
          startTime: now,
          progress: 0,
        };

        setAnimations(prev => [...prev, animation]);

        const timer = setTimeout(() => {
          setAnimations(prev => prev.filter(a => a.id !== animation.id));
        }, entry.durationMs);

        timersRef.current.push(timer);
      };

      window.addEventListener(`${channel}-animation`, handleAnimation);
      return () => {
        window.removeEventListener(`${channel}-animation`, handleAnimation);
        timersRef.current.forEach(t => clearTimeout(t));
        timersRef.current = [];
      };
    }, []);

    useEffect(() => {
      const tick = () => {
        const now = Date.now();
        setAnimations(prev =>
          prev.map(anim => {
            const elapsed = now - anim.startTime;
            const progress = Math.min(elapsed / anim.durationMs, 1);
            return { ...anim, progress };
          })
        );
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current !== undefined) {
          cancelAnimationFrame(rafRef.current);
        }
      };
    }, []);

    return { animations };
  };
}
