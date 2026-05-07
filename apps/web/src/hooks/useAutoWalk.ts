import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/game-store.js';
import { positionToDirection } from '../utils/direction.js';
import { detectNewThreats } from '../utils/threat-detection.js';

const STEP_DELAY_MS = 120;

export function useAutoWalk(): void {
  const walkingRef = useRef(false);
  const cancelledRef = useRef(false);

  const autoWalkPath = useGameStore(s => s.autoWalkPath);
  const autoWalkKnownEnemyIds = useGameStore(s => s.autoWalkKnownEnemyIds);

  useEffect(() => {
    if (autoWalkPath.length === 0 || walkingRef.current) return;

    walkingRef.current = true;
    cancelledRef.current = false;

    const walk = async () => {
      const { sendCommand, cancelAutoWalk } = useGameStore.getState();
      const path = [...autoWalkPath];

      for (let i = 0; i < path.length; i++) {
        if (cancelledRef.current) break;

        const store = useGameStore.getState();
        const playerPos = store.view?.map?.playerPosition;
        if (!playerPos) break;

        const next = path[i]!;
        const direction = positionToDirection(playerPos, next);
        if (!direction) break;

        await sendCommand({ type: 'MOVE', direction });

        // Check for new threats
        const newStore = useGameStore.getState();
        if (newStore.view?.map) {
          const threats = detectNewThreats(autoWalkKnownEnemyIds, newStore.view.map.entities);
          if (threats.length > 0) {
            // Stop and notify via combat log-style update
            break;
          }
        }

        // Check if move was blocked (player position didn't change)
        const newPlayerPos = newStore.view?.map?.playerPosition;
        if (newPlayerPos && (newPlayerPos.x !== next.x || newPlayerPos.y !== next.y)) {
          break;
        }

        // Check if player took damage (health decreased)
        const prevHealth = store.view?.player.health;
        const newHealth = newStore.view?.player.health;
        if (prevHealth !== undefined && newHealth !== undefined && newHealth < prevHealth) {
          break;
        }

        // Check if phase changed (entered combat, game over, etc.)
        if (newStore.view?.phase !== 'dungeon') break;

        // Small delay for visual feedback
        if (i < path.length - 1) {
          await new Promise(resolve => setTimeout(resolve, STEP_DELAY_MS));
        }
      }

      cancelAutoWalk();
      walkingRef.current = false;
    };

    walk();
  }, [autoWalkPath, autoWalkKnownEnemyIds]);

  // Allow external cancellation via keyboard or re-tap
  useEffect(() => {
    const handleKeyDown = () => {
      const { autoWalkPath, cancelAutoWalk } = useGameStore.getState();
      if (autoWalkPath.length > 0) {
        cancelledRef.current = true;
        cancelAutoWalk();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
