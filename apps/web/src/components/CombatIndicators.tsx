import { useState, useEffect } from 'react';
import { COMBAT_INDICATOR_FADEOUT_MS } from '../config/ui-config.js';

interface FloatingLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  type: 'damage' | 'heal' | 'status' | 'gold';
  startTime: number;
}

interface CombatIndicatorsProps {
  vpLeft: number;
  vpTop: number;
  cellSize: number;
  fadeOutDuration?: number; // milliseconds
}

export function CombatIndicators({
  vpLeft,
  vpTop,
  cellSize,
  fadeOutDuration = COMBAT_INDICATOR_FADEOUT_MS,
}: CombatIndicatorsProps) {
  const [labels, setLabels] = useState<FloatingLabel[]>([]);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    const handleAddLabel = (event: CustomEvent<Omit<FloatingLabel, 'id' | 'startTime'>>) => {
      const label = {
        ...event.detail,
        id: `label-${nextId}-${Date.now()}-${Math.random()}`,
        startTime: Date.now(),
      };

      setLabels(prev => [...prev, label]);
      setNextId(prev => prev + 1);

      setTimeout(() => {
        setLabels(prev => prev.filter(l => l.id !== label.id));
      }, fadeOutDuration);
    };

    window.addEventListener('combat-indicator', handleAddLabel as EventListener);
    return () => {
      window.removeEventListener('combat-indicator', handleAddLabel as EventListener);
    };
  }, [nextId, fadeOutDuration]);

  return (
    <>
      {labels.map((label, index) => {
        // Top-right corner positioning
        const screenX = (label.x - vpLeft) * cellSize + cellSize;
        const screenY = (label.y - vpTop) * cellSize;
        const elapsed = Date.now() - label.startTime;
        const progress = elapsed / fadeOutDuration;
        const opacity = Math.max(0, 1 - progress);
        const upDrift = progress * 15; // Drift up slightly over duration

        // Count how many labels at same position with same or earlier start time
        const stackIndex = labels.slice(0, index).filter(
          l => l.x === label.x && l.y === label.y
        ).length;

        // Each stacked label gets pushed down 14px (stack downward from top-right)
        const stackOffset = stackIndex * 14;

        const typeColors = {
          damage: '#f44',
          heal: '#4f4',
          status: '#fa4',
          gold: '#fd4',
        };

        return (
          <div
            key={label.id}
            style={{
              position: 'absolute',
              left: `${screenX}px`,
              top: `${screenY + stackOffset - upDrift}px`,
              transform: 'translateX(-100%)',
              fontSize: '13px',
              fontWeight: 'bold',
              color: typeColors[label.type],
              textShadow: '0 0 3px #000, 0 0 6px #000, 0 0 2px rgba(0,0,0,0.8)',
              opacity,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              zIndex: 100,
              paddingRight: '2px',
            }}
          >
            {label.text}
          </div>
        );
      })}
    </>
  );
}

// Helper to emit combat indicator events
export function emitCombatIndicator(
  x: number,
  y: number,
  text: string,
  type: 'damage' | 'heal' | 'status' | 'gold' = 'damage',
) {
  const event = new CustomEvent('combat-indicator', {
    detail: { x, y, text, type },
  });
  window.dispatchEvent(event);
}
