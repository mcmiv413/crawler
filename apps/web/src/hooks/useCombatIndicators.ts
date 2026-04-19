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
  const previousRef = useRef<readonly CombatIndicatorEntry[]>([]);

  useEffect(() => {
    const previous = previousRef.current;

    // Emit all indicators that are new or different from the previous array
    // We compare by content since server may create new array instances each time
    for (const indicator of indicators) {
      const wasAlreadyEmitted = previous.some(
        p => p.x === indicator.x && p.y === indicator.y && p.text === indicator.text && p.type === indicator.type
      );

      if (!wasAlreadyEmitted) {
        emitCombatIndicator(indicator.x, indicator.y, indicator.text, indicator.type);
      }
    }

    previousRef.current = indicators;
  }, [indicators]);
}
