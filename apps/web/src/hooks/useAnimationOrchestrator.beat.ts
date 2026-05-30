import { useCallback, useEffect, useRef } from 'react';
import type {
  AnimatedEvent,
} from '@dungeon/presenter';
import { getAnimatedEventBatchSettleMs } from '@dungeon/presenter';
import { emitQueueDrained, setQueueDraining } from './animation-queue-bus.js';
import { onHitStopTriggered } from './useHitStop.js';
import { dispatchAnimatedEvent } from './dispatchAnimatedEvent.js';

interface QueuedBatch {
  readonly batchId: string;
  readonly events: readonly AnimatedEvent[];
  readonly settleMs: number;
  nextEventIndex: number;
  logicalElapsedMs: number;
  lastTimestamp: number | null;
}

function createQueuedBatch(animatedEvents: readonly AnimatedEvent[]): QueuedBatch {
  const mutableSortedEvents = [...animatedEvents];
  mutableSortedEvents.sort((a, b) => {
    if (a.delayMs !== b.delayMs) {
      return a.delayMs - b.delayMs;
    }
    return a.sequenceIndex - b.sequenceIndex;
  });

  return {
    batchId: animatedEvents[0]!.batchId,
    events: mutableSortedEvents,
    settleMs: getAnimatedEventBatchSettleMs(animatedEvents),
    nextEventIndex: 0,
    logicalElapsedMs: 0,
    lastTimestamp: null,
  };
}

function cancelFrame(frameId: number): void {
  try {
    cancelAnimationFrame(frameId);
  } catch {
    clearTimeout(frameId as unknown as ReturnType<typeof setTimeout>);
  }
}

export function useBeatAnimationOrchestrator(
  animatedEvents: readonly AnimatedEvent[],
  enabled: boolean,
): void {
  const currentBatchRef = useRef<QueuedBatch | null>(null);
  const queuedBatchesRef = useRef<QueuedBatch[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const pauseRemainingMsRef = useRef(0);
  const lastAcceptedBatchIdRef = useRef<string | null>(null);

  const completeCurrentBatch = useCallback(() => {
    const [nextBatch, ...remainingBatches] = queuedBatchesRef.current;
    queuedBatchesRef.current = remainingBatches;

    if (nextBatch !== undefined) {
      currentBatchRef.current = nextBatch;
      nextBatch.lastTimestamp = null;
      return;
    }

    currentBatchRef.current = null;
    setQueueDraining(false);
    emitQueueDrained();
  }, []);

  const tick = useCallback((timestamp: number) => {
    const currentBatch = currentBatchRef.current;
    if (currentBatch === null) {
      rafRef.current = undefined;
      return;
    }

    if (currentBatch.lastTimestamp === null) {
      currentBatch.lastTimestamp = timestamp;
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    let deltaMs = timestamp - currentBatch.lastTimestamp;
    currentBatch.lastTimestamp = timestamp;

    if (pauseRemainingMsRef.current > 0) {
      const pausedMs = Math.min(deltaMs, pauseRemainingMsRef.current);
      pauseRemainingMsRef.current -= pausedMs;
      deltaMs -= pausedMs;
    }

    if (deltaMs > 0) {
      currentBatch.logicalElapsedMs += deltaMs;
    }

    while (
      currentBatch.nextEventIndex < currentBatch.events.length
      && currentBatch.events[currentBatch.nextEventIndex]!.delayMs <= currentBatch.logicalElapsedMs
    ) {
      const nextEvent = currentBatch.events[currentBatch.nextEventIndex]!;
      dispatchAnimatedEvent(nextEvent);
      currentBatch.nextEventIndex += 1;

      if (nextEvent.type === 'hit-stop' && pauseRemainingMsRef.current > 0) {
        currentBatch.logicalElapsedMs = nextEvent.delayMs;
        break;
      }
    }

    if (
      currentBatch.nextEventIndex >= currentBatch.events.length
      && currentBatch.logicalElapsedMs >= currentBatch.settleMs
    ) {
      completeCurrentBatch();
    }

    if (currentBatchRef.current !== null) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = undefined;
    }
  }, [completeCurrentBatch]);

  const ensureLoopRunning = useCallback(() => {
    rafRef.current ??= requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    if (!enabled) {
      currentBatchRef.current = null;
      queuedBatchesRef.current = [];
      pauseRemainingMsRef.current = 0;
      lastAcceptedBatchIdRef.current = null;
      setQueueDraining(false);
      return;
    }

    const unsubscribeHitStop = onHitStopTriggered((durationMs) => {
      pauseRemainingMsRef.current += durationMs;
    });

    return () => {
      unsubscribeHitStop();
      if (rafRef.current !== undefined) {
        cancelFrame(rafRef.current);
        rafRef.current = undefined;
      }
      currentBatchRef.current = null;
      queuedBatchesRef.current = [];
      pauseRemainingMsRef.current = 0;
      lastAcceptedBatchIdRef.current = null;
      setQueueDraining(false);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || animatedEvents.length === 0) {
      return;
    }

    const batchId = animatedEvents[0]!.batchId;
    if (batchId === lastAcceptedBatchIdRef.current) {
      return;
    }
    lastAcceptedBatchIdRef.current = batchId;

    const batch = createQueuedBatch(animatedEvents);
    if (currentBatchRef.current === null) {
      currentBatchRef.current = batch;
      setQueueDraining(true);
      ensureLoopRunning();
      return;
    }

    queuedBatchesRef.current = [...queuedBatchesRef.current, batch];
  }, [animatedEvents, enabled, ensureLoopRunning]);
}
