import { useEffect, useRef } from 'react';
import type { CombatIndicatorEntry } from '@dungeon/presenter';
import { emitCombatIndicator } from '../components/CombatIndicators.js';

/**
 * Hook that watches combat indicators from the game view and emits them
 * to the floating indicators system. No parsing — indicators are pre-built.
 */
export function useCombatIndicators(
  indicators: readonly CombatIndicatorEntry[],
): void {
  const previousArrayRef = useRef<readonly CombatIndicatorEntry[]>(indicators);

  useEffect(() => {
    const previousArray = previousArrayRef.current;
    const currentArray = indicators;

    // Detect if array changed (new reference or different content)
    if (previousArray !== currentArray) {
      // Find new indicators by comparing lengths
      // (We emit all new ones since last check)
      const startIdx = Math.min(previousArray.length, currentArray.length);
      
      for (let i = startIdx; i < currentArray.length; i++) {
        const indicator = currentArray[i]!;
        emitCombatIndicator(indicator.x, indicator.y, indicator.text, indicator.type);
      }
    }

    previousArrayRef.current = currentArray;
  }, [indicators]);
}
