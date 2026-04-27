import { useState, useEffect, useRef } from 'react';

interface UseDelayedVisibilityReturn {
  isVisible: boolean;
}

/**
 * Hook to delay visibility of a UI element by a specified duration.
 * When trigger becomes true, starts a timer. When timer expires, isVisible becomes true.
 * When trigger becomes false, resets isVisible to false.
 * Useful for delaying overlay screens to allow current animation/state to finish.
 */
export function useDelayedVisibility(trigger: boolean, delayMs: number): UseDelayedVisibilityReturn {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (trigger) {
      // Start timer when trigger becomes true
      timerRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delayMs);

      return () => {
        // Cleanup on trigger change or unmount
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    } else {
      // Reset visibility when trigger becomes false
      setIsVisible(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    }
  }, [trigger, delayMs]);

  return { isVisible };
}
