import { useEffect, useRef, useState } from 'react';

interface HitStopEntry {
  durationMs: number;
  startTime: number;
}

const hitStopChannel = new Map<string, HitStopEntry>();
let hitStopListeners: Set<(isActive: boolean) => void> = new Set();

export function useHitStop(): { isPaused: boolean } {
  const [isPaused, setIsPaused] = useState(false);
  const nextIdRef = useRef(0);

  useEffect(() => {
    const id = String(nextIdRef.current++);

    const checkHitStop = () => {
      const currentTime = Date.now();
      let hasActive = false;

      for (const [entryId, entry] of hitStopChannel) {
        const elapsed = currentTime - entry.startTime;
        if (elapsed < entry.durationMs) {
          hasActive = true;
        } else {
          hitStopChannel.delete(entryId);
        }
      }

      setIsPaused(hasActive);
    };

    const listener = (isActive: boolean) => setIsPaused(isActive);
    hitStopListeners.add(listener);

    const interval = setInterval(checkHitStop, 16);

    return () => {
      clearInterval(interval);
      hitStopListeners.delete(listener);
      hitStopChannel.delete(id);
    };
  }, []);

  return { isPaused };
}

export function triggerHitStop(durationMs: number): void {
  const id = String(Date.now());
  const startTime = Date.now();
  hitStopChannel.set(id, { durationMs, startTime });

  // Notify all listeners
  const isActive = hitStopChannel.size > 0;
  hitStopListeners.forEach(listener => listener(isActive));

  // Auto-cleanup after duration
  setTimeout(() => {
    hitStopChannel.delete(id);
    const stillActive = hitStopChannel.size > 0;
    hitStopListeners.forEach(listener => listener(stillActive));
  }, durationMs);
}
