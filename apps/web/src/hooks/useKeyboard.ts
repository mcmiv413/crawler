import { useEffect } from 'react';
import { useGameStore } from '../store/game-store.js';

const KEY_MAP: Record<string, unknown> = {
  ArrowUp:    { type: 'MOVE', direction: 'N' },
  ArrowDown:  { type: 'MOVE', direction: 'S' },
  ArrowRight: { type: 'MOVE', direction: 'E' },
  ArrowLeft:  { type: 'MOVE', direction: 'W' },
  // Numpad
  Numpad8: { type: 'MOVE', direction: 'N' },
  Numpad2: { type: 'MOVE', direction: 'S' },
  Numpad6: { type: 'MOVE', direction: 'E' },
  Numpad4: { type: 'MOVE', direction: 'W' },
  Numpad7: { type: 'MOVE', direction: 'NW' },
  Numpad9: { type: 'MOVE', direction: 'NE' },
  Numpad1: { type: 'MOVE', direction: 'SW' },
  Numpad3: { type: 'MOVE', direction: 'SE' },
  // Vi keys
  k: { type: 'MOVE', direction: 'N' },
  j: { type: 'MOVE', direction: 'S' },
  l: { type: 'MOVE', direction: 'E' },
  h: { type: 'MOVE', direction: 'W' },
  y: { type: 'MOVE', direction: 'NW' },
  u: { type: 'MOVE', direction: 'NE' },
  b: { type: 'MOVE', direction: 'SW' },
  n: { type: 'MOVE', direction: 'SE' },
  // Wait
  '.': { type: 'WAIT' },
  Numpad5: { type: 'WAIT' },
};

export function useKeyboard(onInspectToggle?: () => void): void {
  const sendCommand = useGameStore(s => s.sendCommand);
  const view = useGameStore(s => s.view);
  const loading = useGameStore(s => s.loading);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (loading) return;

      // 'x' — toggle inspect (roguelike convention for eXamine)
      if (e.key === 'x' && view?.phase === 'dungeon') {
        e.preventDefault();
        onInspectToggle?.();
        return;
      }

      if (view?.phase !== 'dungeon') return;

      // Static key map (movement + wait)
      const command = KEY_MAP[e.key];
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
  }, [sendCommand, view, loading, onInspectToggle]);
}
