import React, { useState, useEffect } from 'react';
import type { EntityView } from '@dungeon/presenter';

interface FloatingLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  type: 'damage' | 'heal' | 'status';
  startTime: number;
}

interface CombatIndicatorsProps {
  entities: readonly EntityView[];
  vpLeft: number;
  vpTop: number;
  cellSize: number;
  fadeOutDuration: number; // milliseconds
}

const FADE_OUT_DURATION = 500;

export function CombatIndicators({ 
  entities, 
  vpLeft, 
  vpTop, 
  cellSize,
  fadeOutDuration = FADE_OUT_DURATION,
}: CombatIndicatorsProps) {
  const [labels, setLabels] = useState<FloatingLabel[]>([]);
  const [nextId, setNextId] = useState(0);

  // Expose method to add labels from parent
  useEffect(() => {
    const handleAddLabel = (event: CustomEvent<Omit<FloatingLabel, 'id' | 'startTime'>>) => {
      const label = {
        ...event.detail,
        id: `label-${nextId}`,
        startTime: Date.now(),
      };
      
      setLabels(prev => [...prev, label]);
      setNextId(prev => prev + 1);

      // Remove label after fade
      setTimeout(() => {
        setLabels(prev => prev.filter(l => l.id !== label.id));
      }, fadeOutDuration);
    };

    window.addEventListener('combat-indicator', handleAddLabel as EventListener);
    return () => window.removeEventListener('combat-indicator', handleAddLabel as EventListener);
  }, [nextId, fadeOutDuration]);

  return (
    <>
      {labels.map(label => {
        const screenX = (label.x - vpLeft) * cellSize + cellSize / 2;
        const screenY = (label.y - vpTop) * cellSize + cellSize / 2;
        const elapsed = Date.now() - label.startTime;
        const progress = elapsed / fadeOutDuration;
        const opacity = Math.max(0, 1 - progress);
        const offset = progress * 20; // Move up 20px over duration

        const typeColors = {
          damage: '#f44',
          heal: '#4f4',
          status: '#fa4',
        };

        return (
          <div
            key={label.id}
            style={{
              position: 'absolute',
              left: `${screenX}px`,
              top: `${screenY - offset}px`,
              transform: 'translate(-50%, -50%)',
              fontSize: '12px',
              fontWeight: 'bold',
              color: typeColors[label.type],
              textShadow: '0 0 2px #000, 0 0 4px #000',
              opacity,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              zIndex: 100,
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
  type: 'damage' | 'heal' | 'status' = 'damage',
) {
  const event = new CustomEvent('combat-indicator', {
    detail: { x, y, text, type },
  });
  window.dispatchEvent(event);
}
