import { useEffect, useState } from 'react';
import type { EntityId } from '@dungeon/contracts';
import type { DefenderHitEntry as PresenterDefenderHitEntry } from '@dungeon/presenter';

export interface DefenderHitEntry {
  readonly durationMs: PresenterDefenderHitEntry['durationMs'];
  readonly startTime: number;
  readonly position?: PresenterDefenderHitEntry['position'];
}

type DefenderHitListener = (updates: Map<EntityId, DefenderHitEntry>) => void;

const defenderHitChannel = new Map<EntityId, DefenderHitEntry>();
const defenderHitListeners = new Set<DefenderHitListener>();
const defenderHitTimers = new Map<EntityId, ReturnType<typeof setTimeout>>();

function notifyDefenderHitListeners(): void {
  const snapshot = new Map(defenderHitChannel);
  for (const listener of defenderHitListeners) {
    listener(snapshot);
  }
}

export function useDefenderHitState(): Map<EntityId, DefenderHitEntry> {
  const [hits, setHits] = useState<Map<EntityId, DefenderHitEntry>>(new Map(defenderHitChannel));

  useEffect(() => {
    defenderHitListeners.add(setHits);
    return () => {
      defenderHitListeners.delete(setHits);
    };
  }, []);

  return hits;
}

export function triggerDefenderHit(
  entityId: EntityId,
  durationMs: number,
  position?: PresenterDefenderHitEntry['position'],
): void {
  const existingTimer = defenderHitTimers.get(entityId);
  if (existingTimer !== undefined) {
    clearTimeout(existingTimer);
  }

  defenderHitChannel.set(entityId, {
    durationMs,
    startTime: Date.now(),
    ...(position !== undefined ? { position } : {}),
  });
  notifyDefenderHitListeners();

  const timer = setTimeout(() => {
    defenderHitTimers.delete(entityId);
    defenderHitChannel.delete(entityId);
    notifyDefenderHitListeners();
  }, durationMs);

  defenderHitTimers.set(entityId, timer);
}
