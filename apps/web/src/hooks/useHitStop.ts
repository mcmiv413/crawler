import { useEffect, useState } from 'react';

type HitStopStateListener = (isActive: boolean) => void;
type HitStopTriggerListener = (durationMs: number) => void;

const hitStopStateListeners = new Set<HitStopStateListener>();
const hitStopTriggerListeners = new Set<HitStopTriggerListener>();
let activeHitStops = 0;

function notifyHitStopState(): void {
  const isActive = activeHitStops > 0;
  for (const listener of hitStopStateListeners) {
    listener(isActive);
  }
}

export function onHitStopTriggered(listener: HitStopTriggerListener): () => void {
  hitStopTriggerListeners.add(listener);
  return () => {
    hitStopTriggerListeners.delete(listener);
  };
}

export function useHitStop(): { isPaused: boolean } {
  const [isPaused, setIsPaused] = useState(activeHitStops > 0);

  useEffect(() => {
    hitStopStateListeners.add(setIsPaused);
    return () => {
      hitStopStateListeners.delete(setIsPaused);
    };
  }, []);

  return { isPaused };
}

export function triggerHitStop(durationMs: number): void {
  if (durationMs <= 0) return;

  for (const listener of hitStopTriggerListeners) {
    listener(durationMs);
  }

  activeHitStops += 1;
  notifyHitStopState();

  setTimeout(() => {
    activeHitStops = Math.max(0, activeHitStops - 1);
    notifyHitStopState();
  }, durationMs);
}
