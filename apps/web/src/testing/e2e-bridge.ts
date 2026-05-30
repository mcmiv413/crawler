import type {
  AbilityAnimationEntry,
  BumpAnimationEntry,
  ConsumableAnimationEntry,
  EntityView,
  MoveAnimationEntry,
  StatusView,
} from '@dungeon/presenter';
import {
  emitAbilityAnimation,
  emitBumpAnimation,
  emitCombatIndicator,
  emitConsumableAnimation,
  emitMoveAnimation,
} from '../animation-runtime/emitters.js';
import { triggerDefenderHit } from '../hooks/useDefenderHitState.js';
import { useGameStore } from '../store/game-store.js';

interface DungeonE2EBridge {
  readonly upsertMapEntity: (entity: EntityView) => void;
  readonly setPlayerStatuses: (statuses: readonly StatusView[]) => void;
  readonly emitMoveAnimation: (animation: MoveAnimationEntry) => void;
  readonly emitBumpAnimation: (animation: BumpAnimationEntry) => void;
  readonly emitConsumableAnimation: (animation: ConsumableAnimationEntry) => void;
  readonly emitAbilityAnimation: (animation: AbilityAnimationEntry) => void;
  readonly emitCombatIndicator: (
    x: number,
    y: number,
    text: string,
    type?: 'damage' | 'heal' | 'status' | 'gold',
  ) => void;
  readonly triggerDefenderHit: (entityId: string, durationMs: number) => void;
}

declare global {
  interface Window {
    __DUNGEON_E2E__?: {
      enabled?: boolean;
      ready?: boolean;
      api?: DungeonE2EBridge;
    };
  }
}

export function installDungeonE2EBridge(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const hook = window.__DUNGEON_E2E__;
  if (hook?.enabled !== true || hook.api !== undefined) {
    return;
  }

  hook.api = {
    upsertMapEntity(entity) {
      const view = useGameStore.getState().view;
      if (view?.map == null) {
        throw new Error('Cannot inject a map entity before a dungeon map is available');
      }

      useGameStore.setState({
        view: {
          ...view,
          map: {
            ...view.map,
            entities: [
              ...view.map.entities.filter((existing) => existing.id !== entity.id),
              entity,
            ],
          },
        },
      });
    },
    setPlayerStatuses(statuses) {
      const view = useGameStore.getState().view;
      if (view == null) {
        throw new Error('Cannot inject player statuses before a view is available');
      }

      useGameStore.setState({
        view: {
          ...view,
          player: {
            ...view.player,
            statuses: [...statuses],
          },
        },
      });
    },
    emitMoveAnimation,
    emitBumpAnimation,
    emitConsumableAnimation,
    emitAbilityAnimation,
    emitCombatIndicator,
    triggerDefenderHit(entityId, durationMs) {
      triggerDefenderHit(entityId as never, durationMs);
    },
  };

  hook.ready = false;
}

export function reportDungeonE2EReady(ready: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  const hook = window.__DUNGEON_E2E__;
  if (hook?.enabled !== true || hook.api === undefined) {
    return;
  }

  hook.ready = ready;
}
