import { useState, useEffect, useRef } from 'react';

interface UseDelayedPhaseTransitionReturn {
  displayPhase: string;
}

/**
 * Hook to delay phase transitions while continuing to display the current phase.
 * When the actual phase changes to a new value, holds the old phase for the delay period
 * before allowing transition. Useful for giving players time to see combat results.
 */
export function useDelayedPhaseTransition(
  actualPhase: string,
  delayMs: number
): UseDelayedPhaseTransitionReturn {
  const [displayPhase, setDisplayPhase] = useState(actualPhase);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const previousPhaseRef = useRef(actualPhase);

  useEffect(() => {
    // If phase actually changed
    if (actualPhase !== previousPhaseRef.current) {
      // Clear any pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Schedule the display phase change after delay
      timerRef.current = setTimeout(() => {
        setDisplayPhase(actualPhase);
      }, delayMs);

      previousPhaseRef.current = actualPhase;
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [actualPhase, delayMs]);

  return { displayPhase };
}
