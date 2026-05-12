import { useEffect, useState } from 'react';
import type { EntityId } from '@dungeon/contracts';

interface DefenderHitEntry {
  durationMs: number;
  startTime: number;
}

const defenderHitChannel = new Map<EntityId, DefenderHitEntry>();
let defenderHitListeners: Set<(updates: Map<EntityId, DefenderHitEntry>) => void> = new Set();

export function useDefenderHitState(): Map<EntityId, DefenderHitEntry> {
  const [hits, setHits] = useState<Map<EntityId, DefenderHitEntry>>(new Map());

  useEffect(() => {
    const checkHits = () => {
      const currentTime = Date.now();
      const mutableExpired: EntityId[] = [];

      for (const [entityId, entry] of defenderHitChannel) {
        const elapsed = currentTime - entry.startTime;
        if (elapsed >= entry.durationMs) {
          mutableExpired.push(entityId);
        }
      }

      // Clean up expired entries
      mutableExpired.forEach(id => defenderHitChannel.delete(id));

      // Notify listeners if there were changes
      if (mutableExpired.length > 0) {
        setHits(new Map(defenderHitChannel));
        defenderHitListeners.forEach(listener => listener(new Map(defenderHitChannel)));
      }
    };

    const listener = (updates: Map<EntityId, DefenderHitEntry>) => setHits(new Map(updates));
    defenderHitListeners.add(listener);

    const interval = setInterval(checkHits, 16);

    return () => {
      clearInterval(interval);
      defenderHitListeners.delete(listener);
    };
  }, []);

  return hits;
}

export function triggerDefenderHit(entityId: EntityId, durationMs: number): void {
  const startTime = Date.now();
  defenderHitChannel.set(entityId, { durationMs, startTime });

  // Notify listeners
  defenderHitListeners.forEach(listener => listener(new Map(defenderHitChannel)));

  // Auto-cleanup
  setTimeout(() => {
    defenderHitChannel.delete(entityId);
    defenderHitListeners.forEach(listener => listener(new Map(defenderHitChannel)));
  }, durationMs);
}
