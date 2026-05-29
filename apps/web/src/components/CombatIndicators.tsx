import { COMBAT_INDICATOR_FADEOUT_MS } from '../config/ui-config.js';
import {
  useCombatIndicatorState,
  type FloatingCombatIndicator,
} from '../hooks/useCombatIndicatorState.js';

interface CombatIndicatorsProps {
  vpLeft: number;
  vpTop: number;
  cellSize: number;
  fadeOutDuration?: number; // milliseconds
  labels?: readonly FloatingCombatIndicator[];
}

export function CombatIndicators({
  vpLeft,
  vpTop,
  cellSize,
  fadeOutDuration = COMBAT_INDICATOR_FADEOUT_MS,
  labels,
}: CombatIndicatorsProps) {
  const liveLabels = useCombatIndicatorState(fadeOutDuration, labels === undefined);
  const renderedLabels = labels ?? liveLabels;

  return (
    <>
      {renderedLabels.map((label, index) => {
        // Top-right corner positioning
        const screenX = (label.x - vpLeft) * cellSize + cellSize;
        const screenY = (label.y - vpTop) * cellSize;
        const elapsed = Date.now() - label.startTime;
        const progress = elapsed / fadeOutDuration;
        const opacity = Math.max(0, 1 - progress);
        const upDrift = progress * 15; // Drift up slightly over duration

        // Count how many labels at same position with same or earlier start time
        const stackIndex = renderedLabels
          .slice(0, index)
          .filter((candidate) => candidate.x === label.x && candidate.y === label.y)
          .length;
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

export type { FloatingCombatIndicator };

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
