import { getAnimatedEventBatchSettleMs } from '@dungeon/presenter';
import type { AnimatedEvent, GameView, CombatLogEntry, MoveAnimationEntry } from '@dungeon/presenter';
import { onQueueDrained } from '../animation-runtime/animation-queue-bus.js';
import { isBeatSchedulerEnabledFlag } from '../config/feature-flags.js';
import { registerMoveAnimation } from '../hooks/useMoveAnimationState.js';

let pendingViewTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingQueueDrainUnsubscribe: (() => void) | null = null;
let pendingQueueDrainCommit: {
  readonly view: GameView;
  readonly combatLog: CombatLogEntry[];
  readonly onCommit: (state: {
    view: GameView;
    combatLog: CombatLogEntry[];
    deathTransitioning: boolean;
    loading: boolean;
  }) => void;
  readonly onDrain?: () => void;
} | null = null;

export function clearPendingViewTimeout(): void {
  if (pendingViewTimeout) {
    clearTimeout(pendingViewTimeout);
  }
  pendingViewTimeout = null;
}

function clearPendingQueueDrainCommit(): void {
  pendingQueueDrainUnsubscribe?.();
  pendingQueueDrainUnsubscribe = null;
  pendingQueueDrainCommit = null;
}

export function clearPendingAnimationCommits(): void {
  clearPendingViewTimeout();
  clearPendingQueueDrainCommit();
}

function isBeatSchedulerEnabled(): boolean {
  return isBeatSchedulerEnabledFlag();
}

function registerImmediateMoveAnimations(animatedEvents: readonly AnimatedEvent[]): void {
  for (const event of animatedEvents) {
    if (event.type === 'move' && event.delayMs <= 0) {
      registerMoveAnimation(event.data as MoveAnimationEntry);
    }
  }
}

function ensureQueueDrainSubscription(): void {
  if (pendingQueueDrainUnsubscribe !== null) {
    return;
  }

  pendingQueueDrainUnsubscribe = onQueueDrained(() => {
    const pendingCommit = pendingQueueDrainCommit;
    clearPendingQueueDrainCommit();
    if (pendingCommit === null) {
      return;
    }
    pendingCommit.onDrain?.();
    pendingCommit.onCommit({
      view: pendingCommit.view,
      combatLog: pendingCommit.combatLog,
      deathTransitioning: false,
      loading: false,
    });
  });
}

export interface CommandResultCommitOptions {
  readonly view: GameView;
  readonly combatLog: CombatLogEntry[];
  readonly isDeath: boolean;
  readonly currentView: GameView | null;
  readonly onCommit: (state: {
    view: GameView;
    combatLog: CombatLogEntry[];
    deathTransitioning: boolean;
    loading: boolean;
  }) => void;
  readonly onDrain?: () => void;
}

export function scheduleCommandResultCommit(options: CommandResultCommitOptions): void {
  const animationSettleMs = getAnimatedEventBatchSettleMs(options.view.animatedEvents);
  const shouldStageView =
    options.currentView !== null &&
    options.currentView.phase === 'dungeon' &&
    animationSettleMs > 0;

  if (!shouldStageView && !options.isDeath) {
    clearPendingAnimationCommits();
    registerImmediateMoveAnimations(options.view.animatedEvents);
    options.onCommit({
      view: options.view,
      combatLog: options.combatLog,
      deathTransitioning: false,
      loading: false,
    });
    return;
  }

  clearPendingViewTimeout();

  if (shouldStageView) {
    if (isBeatSchedulerEnabled()) {
      pendingQueueDrainCommit = {
        view: options.view,
        combatLog: options.combatLog,
        onCommit: options.onCommit,
        onDrain: options.onDrain,
      };
      ensureQueueDrainSubscription();
      registerImmediateMoveAnimations(options.view.animatedEvents);
      options.onCommit({
        view: options.view,
        combatLog: options.combatLog,
        deathTransitioning: options.isDeath,
        loading: false,
      });
      return;
    }

    clearPendingQueueDrainCommit();
    registerImmediateMoveAnimations(options.view.animatedEvents);
    options.onCommit({
      view: options.view,
      combatLog: options.combatLog,
      deathTransitioning: options.isDeath,
      loading: false,
    });

    pendingViewTimeout = setTimeout(() => {
      options.onCommit({
        view: options.view,
        combatLog: options.combatLog,
        loading: false,
        deathTransitioning: false,
      });
      pendingViewTimeout = null;
    }, options.isDeath ? Math.max(animationSettleMs, 2000) : animationSettleMs);
    return;
  }

  clearPendingQueueDrainCommit();
  options.onCommit({
    view: options.view,
    combatLog: options.combatLog,
    deathTransitioning: true,
    loading: false,
  });

  pendingViewTimeout = setTimeout(() => {
    options.onCommit({
      view: options.view,
      combatLog: options.combatLog,
      deathTransitioning: false,
      loading: false,
    });
    pendingViewTimeout = null;
  }, 2000);
}
