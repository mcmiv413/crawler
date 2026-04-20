import { useState, useEffect } from 'react';
import type { BumpAnimationEntry } from '@dungeon/presenter';
import { BUMP_ANIMATION_DURATION_MS } from '../config/ui-config.js';

interface ActiveAnimation {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerPos: { x: number; y: number };
  defenderPos: { x: number; y: number };
  startTime: number;
}

interface BumpAnimationsProps {
  vpLeft: number;
  vpTop: number;
  cellSize: number;
  duration?: number; // milliseconds
}

export function BumpAnimations({
  vpLeft,
  vpTop,
  cellSize,
  duration = BUMP_ANIMATION_DURATION_MS,
}: BumpAnimationsProps) {
  const [animations, setAnimations] = useState<ActiveAnimation[]>([]);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    const handleBumpAnimation = (event: CustomEvent<BumpAnimationEntry>) => {
      const animation: ActiveAnimation = {
        id: `bump-${nextId}-${Date.now()}-${Math.random()}`,
        ...event.detail,
        startTime: Date.now(),
      };

      setAnimations(prev => [...prev, animation]);
      setNextId(prev => prev + 1);

      setTimeout(() => {
        setAnimations(prev => prev.filter(a => a.id !== animation.id));
      }, duration);
    };

    window.addEventListener('bump-animation', handleBumpAnimation as EventListener);
    return () => {
      window.removeEventListener('bump-animation', handleBumpAnimation as EventListener);
    };
  }, [nextId, duration]);

  return (
    <>
      <style>{`
        @keyframes bump {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: translate(var(--bump-dx), var(--bump-dy));
            opacity: 1;
          }
        }
      `}</style>
      {animations.map((anim) => {
        const screenX = (anim.attackerPos.x - vpLeft) * cellSize;
        const screenY = (anim.attackerPos.y - vpTop) * cellSize;

        // Calculate distance to target (50% of the way)
        const deltaX = (anim.defenderPos.x - anim.attackerPos.x) * cellSize * 0.5;
        const deltaY = (anim.defenderPos.y - anim.attackerPos.y) * cellSize * 0.5;

        return (
          <div
            key={anim.id}
            data-testid="bump-animation"
            style={{
              position: 'absolute',
              left: `${screenX}px`,
              top: `${screenY}px`,
              width: cellSize,
              height: cellSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 50,
              // CSS custom properties for the animation
              // @ts-ignore - CSS custom properties
              '--bump-dx': `${deltaX}px`,
              '--bump-dy': `${deltaY}px`,
              animation: `bump ${duration}ms ease-out forwards`,
            }}
          >
            {/* Render a copy of the attacker sprite/character */}
            <div
              style={{
                width: cellSize - 2,
                height: cellSize - 2,
                border: '1px solid #fff',
                borderRadius: '2px',
                background: 'rgba(255, 255, 255, 0.3)',
              }}
            />
          </div>
        );
      })}
    </>
  );
}

// Helper to emit bump animation events
export function emitBumpAnimation(animation: BumpAnimationEntry) {
  const event = new CustomEvent('bump-animation', {
    detail: animation,
  });
  window.dispatchEvent(event);
}
