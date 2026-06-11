import { useCallback, useEffect, useRef } from 'react';
import type { Direction } from '@dungeon/contracts';
import type { MoveAnimationEntry } from '@dungeon/presenter';
import { STEP_WALK_BOUNDARY_PROGRESS } from '../animations/move-style-profiles.js';
import { dispatchWalkContinuation } from '../animation-runtime/walk-continuation-bus.js';
import { MOVEMENT_KEY_DIRECTIONS } from './useKeyboard.js';
import { useGameStore } from '../store/game-store.js';
import { positionToDirection } from '../utils/direction.js';
import { detectNewThreats } from '../utils/threat-detection.js';
import { subscribeMoveAnimation } from './useMoveAnimationState.js';

interface AutoWalkSession {
  readonly path: readonly { readonly x: number; readonly y: number }[];
  readonly knownEnemyIds: ReadonlySet<string>;
  nextIndex: number;
}

interface NextMoveIntent {
  readonly direction: Direction;
  readonly target?: { readonly x: number; readonly y: number };
  readonly source: 'held' | 'auto';
}

const EMPTY_AUTO_WALK_PATH: readonly { readonly x: number; readonly y: number }[] = [];
const EMPTY_AUTO_WALK_KNOWN_ENEMY_IDS: ReadonlySet<string> = new Set();

export function useWalkController(): void {
  const loading = useGameStore((state) => state.loading);
  const phase = useGameStore((state) => state.view?.phase);
  const autoWalkPath = useGameStore((state) => state.autoWalkPath);
  const autoWalkKnownEnemyIds = useGameStore(
    (state) => state.autoWalkKnownEnemyIds,
  );

  const autoWalkSessionRef = useRef<AutoWalkSession | null>(null);
  const heldDirectionsRef = useRef(new Map<string, Direction>());
  const heldKeyOrderRef = useRef<string[]>([]);
  const playerMoveEntityIdRef = useRef<string | null>(null);
  const playerMoveActiveRef = useRef(false);
  const boundaryReadyRef = useRef(false);
  const boundaryTimerRef = useRef<number | undefined>(undefined);
  const moveClearTimerRef = useRef<number | undefined>(undefined);
  const dispatchInFlightRef = useRef(false);
  const continuationRef = useRef(false);

  const getHeldDirection = useCallback((): Direction | null => {
    const activeKey = heldKeyOrderRef.current[heldKeyOrderRef.current.length - 1];
    return activeKey === undefined
      ? null
      : heldDirectionsRef.current.get(activeKey) ?? null;
  }, []);

  const cancelActiveAutoWalk = useCallback(() => {
    autoWalkSessionRef.current = null;
    useGameStore.getState().cancelAutoWalk();
  }, []);

  const hasContinuationIntent = useCallback((): boolean => {
    if (getHeldDirection() !== null) {
      return true;
    }

    const session = autoWalkSessionRef.current;
    return session !== null && session.nextIndex < session.path.length;
  }, [getHeldDirection]);

  const updateWalkContinuationSignal = useCallback(() => {
    const entityId = playerMoveEntityIdRef.current;
    if (entityId === null) {
      return;
    }

    const continuing = hasContinuationIntent();
    if (continuationRef.current === continuing) {
      return;
    }

    continuationRef.current = continuing;
    dispatchWalkContinuation({ entityId, continuing });
  }, [hasContinuationIntent]);

  const getNextMoveIntent = useCallback((): NextMoveIntent | null => {
    const heldDirection = getHeldDirection();
    if (heldDirection !== null) {
      return { source: 'held', direction: heldDirection };
    }

    const session = autoWalkSessionRef.current;
    if (session === null) {
      return null;
    }

    const currentView = useGameStore.getState().view;
    if (currentView?.phase !== 'dungeon' || currentView.map === null) {
      return null;
    }
    const playerPosition = currentView.map.playerPosition;

    const target = session.path[session.nextIndex];
    if (target === undefined) {
      return null;
    }

    const direction = positionToDirection(playerPosition, target);
    if (direction === null) {
      cancelActiveAutoWalk();
      return null;
    }

    return {
      source: 'auto',
      direction,
      target,
    };
  }, [cancelActiveAutoWalk, getHeldDirection]);

  const maybeDispatchNextMove = useCallback(() => {
    if (dispatchInFlightRef.current) {
      return;
    }

    const store = useGameStore.getState();
    if (store.loading || store.view?.phase !== 'dungeon') {
      return;
    }

    const intent = getNextMoveIntent();
    if (intent === null) {
      updateWalkContinuationSignal();
      return;
    }

    if (playerMoveActiveRef.current && !boundaryReadyRef.current) {
      updateWalkContinuationSignal();
      return;
    }

    boundaryReadyRef.current = false;
    dispatchInFlightRef.current = true;

    void (async () => {
      try {
        const beforeStore = useGameStore.getState();
        const target = intent.target;
        if (intent.source === 'auto') {
          const session = autoWalkSessionRef.current;
          if (session === null || target === undefined) {
            return;
          }
          session.nextIndex += 1;
          updateWalkContinuationSignal();
        }

        await beforeStore.sendCommand({ type: 'MOVE', direction: intent.direction });

        if (intent.source !== 'auto' || target === undefined) {
          return;
        }

        const session = autoWalkSessionRef.current;
        if (session === null) {
          return;
        }

        const afterStore = useGameStore.getState();
        const afterView = afterStore.view;
        if (afterView?.phase !== 'dungeon' || afterView.map === null) {
          cancelActiveAutoWalk();
          return;
        }
        const afterMap = afterView.map;

        const threats = detectNewThreats(session.knownEnemyIds, afterMap.entities);
        if (threats.length > 0) {
          cancelActiveAutoWalk();
          return;
        }

        const previousHealth = beforeStore.view?.player.health;
        const currentHealth = afterView.player.health;
        if (previousHealth !== undefined && currentHealth < previousHealth) {
          cancelActiveAutoWalk();
          return;
        }

        const playerPosition = afterMap.playerPosition;
        if (playerPosition.x !== target.x || playerPosition.y !== target.y) {
          cancelActiveAutoWalk();
          return;
        }

        if (session.nextIndex >= session.path.length) {
          cancelActiveAutoWalk();
        }
      } finally {
        dispatchInFlightRef.current = false;
      }
    })();
  }, [cancelActiveAutoWalk, getNextMoveIntent, updateWalkContinuationSignal]);

  useEffect(() => {
    if (autoWalkPath.length === 0) {
      autoWalkSessionRef.current = null;
      updateWalkContinuationSignal();
      return;
    }

    autoWalkSessionRef.current = {
      path: [...autoWalkPath],
      knownEnemyIds: new Set(autoWalkKnownEnemyIds),
      nextIndex: 0,
    };
    updateWalkContinuationSignal();
    maybeDispatchNextMove();
  }, [autoWalkKnownEnemyIds, autoWalkPath, maybeDispatchNextMove, updateWalkContinuationSignal]);

  useEffect(() => {
    updateWalkContinuationSignal();
    if (!loading) {
      maybeDispatchNextMove();
    }
  }, [loading, maybeDispatchNextMove, updateWalkContinuationSignal]);

  useEffect(() => {
    if (phase === 'dungeon') {
      return;
    }

    boundaryReadyRef.current = false;
    playerMoveActiveRef.current = false;
    autoWalkSessionRef.current = null;
    updateWalkContinuationSignal();
  }, [phase, updateWalkContinuationSignal]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = MOVEMENT_KEY_DIRECTIONS[event.key];
      if (direction === undefined) {
        return;
      }

      const viewPhase = useGameStore.getState().view?.phase;
      if (viewPhase !== 'dungeon') {
        return;
      }

      event.preventDefault();

      if (!heldDirectionsRef.current.has(event.key)) {
        const mutableHeldKeyOrder = heldKeyOrderRef.current.filter((key) => key !== event.key);
        mutableHeldKeyOrder.push(event.key);
        heldKeyOrderRef.current = mutableHeldKeyOrder;
      }
      heldDirectionsRef.current.set(event.key, direction);

      if (autoWalkSessionRef.current !== null) {
        cancelActiveAutoWalk();
      }

      updateWalkContinuationSignal();
      maybeDispatchNextMove();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!heldDirectionsRef.current.has(event.key)) {
        return;
      }

      heldDirectionsRef.current.delete(event.key);
      heldKeyOrderRef.current = heldKeyOrderRef.current.filter((key) => key !== event.key);
      updateWalkContinuationSignal();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cancelActiveAutoWalk, maybeDispatchNextMove, updateWalkContinuationSignal]);

  useEffect(() => {
    const handleMoveAnimation = (entry: MoveAnimationEntry) => {
      const currentView = useGameStore.getState().view;
      if (currentView?.phase !== 'dungeon' || currentView.map === null) {
        return;
      }
      const playerEntityId = currentView.map.entities.find((entity) => entity.type === 'player')?.id;
      if (playerEntityId !== undefined && entry.entityId !== playerEntityId) {
        return;
      }
      const playerPosition = currentView.map.playerPosition;
      const matchesCommittedPosition = playerPosition.x === entry.toPos.x && playerPosition.y === entry.toPos.y;
      const matchesPreCommitPosition = playerPosition.x === entry.fromPos.x && playerPosition.y === entry.fromPos.y;
      if (!matchesCommittedPosition && !matchesPreCommitPosition) {
        return;
      }

      playerMoveEntityIdRef.current = entry.entityId;
      playerMoveActiveRef.current = true;
      boundaryReadyRef.current = false;

      if (boundaryTimerRef.current !== undefined) {
        window.clearTimeout(boundaryTimerRef.current);
      }
      if (moveClearTimerRef.current !== undefined) {
        window.clearTimeout(moveClearTimerRef.current);
      }

      continuationRef.current = hasContinuationIntent();
      dispatchWalkContinuation({ entityId: entry.entityId, continuing: continuationRef.current });

      boundaryTimerRef.current = window.setTimeout(() => {
        boundaryReadyRef.current = true;
        maybeDispatchNextMove();
      }, entry.durationMs * STEP_WALK_BOUNDARY_PROGRESS);

      moveClearTimerRef.current = window.setTimeout(() => {
        playerMoveActiveRef.current = false;
        boundaryReadyRef.current = false;
      }, entry.durationMs);
    };

    const unsubscribeMoveAnimation = subscribeMoveAnimation(handleMoveAnimation);
    return () => {
      unsubscribeMoveAnimation();
      if (boundaryTimerRef.current !== undefined) {
        window.clearTimeout(boundaryTimerRef.current);
      }
      if (moveClearTimerRef.current !== undefined) {
        window.clearTimeout(moveClearTimerRef.current);
      }
    };
  }, [hasContinuationIntent, maybeDispatchNextMove]);
}
