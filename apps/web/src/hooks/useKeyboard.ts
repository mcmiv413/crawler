import { useEffect, useRef } from 'react';
import type { Direction } from '@dungeon/contracts';
import { useGameStore } from '../store/game-store.js';

export const MOVEMENT_KEY_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'N',
  ArrowDown: 'S',
  ArrowRight: 'E',
  ArrowLeft: 'W',
  // Numpad
  Numpad8: 'N',
  Numpad2: 'S',
  Numpad6: 'E',
  Numpad4: 'W',
  Numpad7: 'NW',
  Numpad9: 'NE',
  Numpad1: 'SW',
  Numpad3: 'SE',
  // Vi keys
  k: 'N',
  j: 'S',
  l: 'E',
  h: 'W',
  y: 'NW',
  u: 'NE',
  b: 'SW',
  n: 'SE',
};

const STATIC_KEY_COMMANDS: Record<string, { readonly type: 'WAIT' }> = {
  // Wait
  '.': { type: 'WAIT' },
  Numpad5: { type: 'WAIT' },
};

export function useKeyboard(onInspectToggle?: () => void): void {
  const inspectToggleRef = useRef(onInspectToggle);

  useEffect(() => {
    inspectToggleRef.current = onInspectToggle;
  }, [onInspectToggle]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const { sendCommand, view, loading } = useGameStore.getState();
      if (loading) return;

      // 'x' — toggle inspect (roguelike convention for eXamine)
      if (e.key === 'x' && view?.phase === 'dungeon') {
        e.preventDefault();
        inspectToggleRef.current?.();
        return;
      }

      if (view?.phase !== 'dungeon') return;

      if (e.key in MOVEMENT_KEY_DIRECTIONS) {
        return;
      }

      const command = STATIC_KEY_COMMANDS[e.key];
      if (command) {
        e.preventDefault();
        sendCommand(command);
        return;
      }

      // Context-sensitive keys based on available actions
      const actions = view.availableActions;

      // 'a' — attack first available target
      if (e.key === 'a') {
        const attackAction = actions.find(
          (a: { type: string; enabled: boolean }) => a.type === 'attack' && a.enabled,
        );
        if (attackAction?.targetId) {
          e.preventDefault();
          sendCommand({ type: 'ATTACK', targetId: attackAction.targetId });
          return;
        }
      }

      // 'r' — retreat
      if (e.key === 'r') {
        const retreatAction = actions.find(
          (a: { type: string; enabled: boolean }) => a.type === 'retreat' && a.enabled,
        );
        if (retreatAction) {
          e.preventDefault();
          sendCommand({ type: 'RETREAT' });
          return;
        }
      }

      // '<' — ascend
      if (e.key === '<') {
        const ascendAction = actions.find(
          (a: { type: string; enabled: boolean }) => a.type === 'ascend' && a.enabled,
        );
        if (ascendAction) {
          e.preventDefault();
          sendCommand({ type: 'ASCEND' });
          return;
        }
      }

      // 'e' — equip first available equippable
      if (e.key === 'e') {
        const equipAction = actions.find(
          (a: { type: string; id: string; enabled: boolean }) => a.type === 'item' && a.id.startsWith('equip_') && a.enabled,
        );
        if (equipAction?.targetId) {
          e.preventDefault();
          sendCommand({ type: 'EQUIP', itemId: equipAction.targetId });
          return;
        }
      }

      // '1'-'9' — use item by inventory slot
      if (e.key >= '1' && e.key <= '9') {
        const itemActions = actions.filter(
          (a: { type: string; enabled: boolean }) => a.type === 'item' && a.enabled,
        );
        const index = parseInt(e.key, 10) - 1;
        if (index < itemActions.length && itemActions[index]!.targetId) {
          e.preventDefault();
          sendCommand({ type: 'USE_ITEM', itemId: itemActions[index]!.targetId! });
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
}
