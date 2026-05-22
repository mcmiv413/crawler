import { useEffect, useRef } from 'react';
import { isBeatSchedulerEnabledFlag } from '../config/feature-flags.js';
import { useGameStore } from '../store/game-store.js';
import { positionToDirection } from '../utils/direction.js';
import { detectNewThreats } from '../utils/threat-detection.js';
import { isQueueDraining, onQueueDrained } from './animation-queue-bus.js';

const STEP_DELAY_MS = 120;

export function useAutoWalk(): void {
  const walkingRef = useRef(false);
  const cancelledRef = useRef(false);
  const queueDrainUnsubscribeRef = useRef<(() => void) | null>(null);

  const autoWalkPath = useGameStore(s => s.autoWalkPath);
  const autoWalkKnownEnemyIds = useGameStore(s => s.autoWalkKnownEnemyIds);

  useEffect(() => () => {
    cancelledRef.current = true;
    queueDrainUnsubscribeRef.current?.();
    queueDrainUnsubscribeRef.current = null;
    walkingRef.current = false;
  }, []);

  function wasCancelled(): boolean {
    return cancelledRef.current;
  }

  useEffect(() => {
    if (autoWalkPath.length === 0 || walkingRef.current) return;

    walkingRef.current = true;
    cancelledRef.current = false;

    async function waitForActiveQueueToDrain(): Promise<void> {
      if (isBeatSchedulerEnabledFlag() === false || isQueueDraining() === false) {
        return;
      }

      await new Promise<void>((resolve) => {
        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          queueDrainUnsubscribeRef.current = null;
          resolve();
        };
        const unsubscribe = onQueueDrained(() => {
          unsubscribe();
          finish();
        });
        queueDrainUnsubscribeRef.current = unsubscribe;

        if (isQueueDraining() === false) {
          unsubscribe();
          finish();
        }
      });
    }

    const walk = async () => {
      const { sendCommand, cancelAutoWalk } = useGameStore.getState();
      const path = [...autoWalkPath];

      try {
        for (let i = 0; i < path.length; i++) {
          if (wasCancelled()) break;

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

          if (wasCancelled()) break;

          if (i < path.length - 1) {
            if (isBeatSchedulerEnabledFlag() && isQueueDraining()) {
              await waitForActiveQueueToDrain();
            } else {
              await new Promise(resolve => setTimeout(resolve, STEP_DELAY_MS));
            }
          }
        }
      } finally {
        queueDrainUnsubscribeRef.current?.();
        queueDrainUnsubscribeRef.current = null;
        cancelAutoWalk();
        walkingRef.current = false;
      }
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
