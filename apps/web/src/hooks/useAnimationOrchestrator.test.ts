/**
 * Test layer: unit
 * Behavior: useAnimationOrchestrator schedules animated events with legacy timeout and beat schedulers while preserving batch order through pauses and rerenders.
 * Proof: Mock emitter assertions verify emitCombatIndicator timing for legacy, beat, and hit-stop cases plus emitted text order ['first', 'second'] and move entity order ['player-1', 'enemy-1'].
 * Validation: pnpm vitest run apps/web/src/hooks/useAnimationOrchestrator.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { type AnimatedEvent, type MoveAnimationEntry } from '@dungeon/presenter';
import * as runtimeEmitters from '../animation-runtime/emitters.js';
import { useAnimationOrchestrator } from '../animation-runtime/useAnimationOrchestrator.js';

vi.mock('../animation-runtime/emitters.js', () => ({
  emitAbilityAnimation: vi.fn(),
  emitBumpAnimation: vi.fn(),
  emitCombatIndicator: vi.fn(),
  emitConsumableAnimation: vi.fn(),
  emitMoveAnimation: vi.fn(),
}));

function setBeatSchedulerFlag(value: string): void {
  globalThis.__DUNGEON_BEAT_SCHEDULER_OVERRIDE__ = value !== 'false';
}

function createDamageEvent(args: {
  readonly batchId: string;
  readonly beatId: string;
  readonly delayMs: number;
  readonly sequenceIndex?: number;
  readonly text: string;
}): AnimatedEvent {
  return {
    type: 'damage',
    sequenceIndex: args.sequenceIndex ?? 0,
    delayMs: args.delayMs,
    beatId: args.beatId,
    beatIndex: 0,
    beatRelativeDelayMs: args.delayMs,
    batchId: args.batchId,
    data: {
      x: 5,
      y: 5,
      text: args.text,
      type: 'damage',
    },
  } satisfies AnimatedEvent;
}

function createMoveEvent(args: {
  readonly batchId: string;
  readonly beatId: string;
  readonly durationMs: number;
  readonly impactFrameMs: number;
  readonly entityId?: string;
  readonly fromPos?: { readonly x: number; readonly y: number };
  readonly toPos?: { readonly x: number; readonly y: number };
  readonly delayMs?: number;
  readonly sequenceIndex?: number;
  readonly beatIndex?: number;
}): AnimatedEvent {
  return {
    type: 'move',
    sequenceIndex: args.sequenceIndex ?? 0,
    delayMs: args.delayMs ?? 0,
    beatId: args.beatId,
    beatIndex: args.beatIndex ?? 0,
    beatRelativeDelayMs: 0,
    batchId: args.batchId,
    data: {
      entityId: args.entityId ?? 'player-1',
      fromPos: args.fromPos ?? { x: 0, y: 0 },
      toPos: args.toPos ?? { x: 1, y: 0 },
      style: 'step',
      durationMs: args.durationMs,
      impactFrameMs: args.impactFrameMs,
    } as MoveAnimationEntry & { impactFrameMs: number },
  } satisfies AnimatedEvent;
}

function createHitStopEvent(args: {
  readonly batchId: string;
  readonly beatId: string;
  readonly durationMs: number;
}): AnimatedEvent {
  return {
    type: 'hit-stop',
    sequenceIndex: 1,
    delayMs: 0,
    beatId: args.beatId,
    beatIndex: 0,
    beatRelativeDelayMs: 0,
    batchId: args.batchId,
    data: {
      durationMs: args.durationMs,
    },
  } satisfies AnimatedEvent;
}

describe('useAnimationOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setBeatSchedulerFlag('false');
    vi.stubGlobal(
      'requestAnimationFrame',
      ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16)) as unknown as typeof requestAnimationFrame,
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      ((id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as unknown as typeof cancelAnimationFrame,
    );
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    globalThis.__DUNGEON_BEAT_SCHEDULER_OVERRIDE__ = undefined;
  });

  it('uses the legacy timeout scheduler when the beat flag is off', async () => {
    const event = createDamageEvent({
      batchId: 'legacy-batch',
      beatId: 'legacy-beat',
      delayMs: 40,
      text: 'legacy',
    });

    renderHook(() => useAnimationOrchestrator([event]));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(39);
    });
    expect(runtimeEmitters.emitCombatIndicator).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(runtimeEmitters.emitCombatIndicator).toHaveBeenCalledWith(5, 5, 'legacy', 'damage');
  });

  it('uses the beat scheduler when the flag is on', () => {
    setBeatSchedulerFlag('true');
    const event = createDamageEvent({
      batchId: 'beat-batch',
      beatId: 'beat-0',
      delayMs: 16,
      text: 'beat',
    });

    renderHook(() => useAnimationOrchestrator([event]));

    act(() => {
      vi.advanceTimersByTime(32);
    });

    expect(runtimeEmitters.emitCombatIndicator).toHaveBeenCalledWith(5, 5, 'beat', 'damage');
  });

  it('continues beat scheduling after hit-stop events', async () => {
    setBeatSchedulerFlag('true');
    const batchId = 'pause-batch';
    const beatId = 'pause-beat';
    const events: AnimatedEvent[] = [
      createMoveEvent({ batchId, beatId, durationMs: 100, impactFrameMs: 50 }),
      createHitStopEvent({ batchId, beatId, durationMs: 80 }),
      createDamageEvent({ batchId, beatId, delayMs: 120, sequenceIndex: 2, text: 'after-pause' }),
    ];

    renderHook(() => useAnimationOrchestrator(events));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(32);
    });

    expect(runtimeEmitters.emitCombatIndicator).not.toHaveBeenCalled();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(runtimeEmitters.emitCombatIndicator).toHaveBeenCalledWith(5, 5, 'after-pause', 'damage');
  });

  it('queues new batches mid-drain without preempting the active batch', async () => {
    setBeatSchedulerFlag('true');

    const firstBatch: AnimatedEvent[] = [
      createMoveEvent({
        batchId: 'batch-1',
        beatId: 'beat-1',
        durationMs: 120,
        impactFrameMs: 60,
      }),
      createDamageEvent({
        batchId: 'batch-1',
        beatId: 'beat-1',
        delayMs: 0,
        sequenceIndex: 1,
        text: 'first',
      }),
    ];
    const secondBatch = [createDamageEvent({
      batchId: 'batch-2',
      beatId: 'beat-2',
      delayMs: 16,
      text: 'second',
    })];

    const { rerender } = renderHook(
      ({ events }: { events: readonly AnimatedEvent[] }) => useAnimationOrchestrator(events),
      { initialProps: { events: firstBatch } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    rerender({ events: secondBatch });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const emittedTexts = vi.mocked(runtimeEmitters.emitCombatIndicator).mock.calls.map((call) => call[2]);
    expect(emittedTexts).toEqual(['first', 'second']);
  });

  it('dispatches the compact visible beat batch in order', async () => {
    setBeatSchedulerFlag('true');
    renderHook(() => useAnimationOrchestrator([
      createMoveEvent({
        batchId: 'visible-batch',
        beatId: 'beat-0',
        beatIndex: 0,
        sequenceIndex: 0,
        delayMs: 0,
        durationMs: 120,
        impactFrameMs: 60,
        entityId: 'player-1',
        fromPos: { x: 0, y: 0 },
        toPos: { x: 1, y: 0 },
      }),
      createMoveEvent({
        batchId: 'visible-batch',
        beatId: 'beat-1',
        beatIndex: 1,
        sequenceIndex: 1,
        delayMs: 120,
        durationMs: 120,
        impactFrameMs: 60,
        entityId: 'enemy-1',
        fromPos: { x: 2, y: 0 },
        toPos: { x: 2, y: 1 },
      }),
    ]));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const moveEntityIds = vi
      .mocked(runtimeEmitters.emitMoveAnimation)
      .mock.calls
      .map(([entry]) => entry.entityId);

    expect(moveEntityIds).toEqual([
      'player-1',
      'enemy-1',
    ]);
  });
});
