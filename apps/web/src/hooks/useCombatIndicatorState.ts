import { useEffect, useRef, useState } from 'react';

export interface FloatingCombatIndicator {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly type: 'damage' | 'heal' | 'status' | 'gold';
  readonly startTime: number;
}

interface CombatIndicatorEventDetail {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly type: 'damage' | 'heal' | 'status' | 'gold';
}

export function useCombatIndicatorState(
  fadeOutDuration: number,
  enabled = true,
): readonly FloatingCombatIndicator[] {
  const [labels, setLabels] = useState<FloatingCombatIndicator[]>([]);
  const nextIdRef = useRef(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!enabled) {
      setLabels((current) => (current.length === 0 ? current : []));
      return;
    }

    const handleAddLabel = (event: Event) => {
      const { x, y, text, type } = (event as CustomEvent<CombatIndicatorEventDetail>).detail;
      const label: FloatingCombatIndicator = {
        id: `label-${nextIdRef.current++}-${Date.now()}`,
        x,
        y,
        text,
        type,
        startTime: Date.now(),
      };

      setLabels((prev) => [...prev, label]);

      const timeout = setTimeout(() => {
        setLabels((prev) => prev.filter((entry) => entry.id !== label.id));
      }, fadeOutDuration);

      timeoutsRef.current = [...timeoutsRef.current, timeout];
    };

    window.addEventListener('combat-indicator', handleAddLabel);
    return () => {
      window.removeEventListener('combat-indicator', handleAddLabel);
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current = [];
    };
  }, [enabled, fadeOutDuration]);

  return labels;
}
