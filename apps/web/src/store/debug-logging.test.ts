import { describe, it, expect, vi, afterEach } from 'vitest';
import { isAttackCommand, logDebugAttack, logDebugCombatResult } from './debug-logging.js';
import type { GameView } from '@dungeon/presenter';

describe('debug-logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAttackCommand', () => {
    it('returns true for ATTACK command', () => {
      const command = { type: 'ATTACK', targetId: 'enemy-1' };
      expect(isAttackCommand(command)).toBe(true);
    });

    it('returns false for non-ATTACK command', () => {
      const command = { type: 'MOVE', x: 5, y: 5 };
      expect(isAttackCommand(command)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isAttackCommand(null)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(isAttackCommand('ATTACK')).toBe(false);
      expect(isAttackCommand(123)).toBe(false);
    });
  });

  describe('logDebugAttack', () => {
    it('does not call console.log when debugLogging is false', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const view: Partial<GameView> = {
        player: { accuracy: 75, attack: 10 } as any,
      };
      const command = { type: 'ATTACK', targetId: 'enemy-1' };

      logDebugAttack(false, command, view as GameView);

      expect(spy).not.toHaveBeenCalled();
    });

    it('does not call console.log when command is not ATTACK', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const view: Partial<GameView> = {
        player: { accuracy: 75, attack: 10 } as any,
      };
      const command = { type: 'MOVE', x: 5, y: 5 };

      logDebugAttack(true, command, view as GameView);

      expect(spy).not.toHaveBeenCalled();
    });

    it('calls console.log when debugLogging is true and command is ATTACK', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const view: Partial<GameView> = {
        player: { accuracy: 75, attack: 10 } as any,
      };
      const command = { type: 'ATTACK', targetId: 'enemy-1' };

      logDebugAttack(true, command, view as GameView);

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith('[DEBUG] Attack Command:', expect.any(Object));
    });

    it('calls console.log with null view (with undefined player values)', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const command = { type: 'ATTACK', targetId: 'enemy-1' };

      logDebugAttack(true, command, null);

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith('[DEBUG] Attack Command:', expect.objectContaining({
        playerAccuracy: undefined,
        playerAttack: undefined,
        command,
      }));
    });
  });

  describe('logDebugCombatResult', () => {
    it('does not call console.log when debugLogging is false', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const view: Partial<GameView> = {
        player: { health: 80 } as any,
        combatLog: [{ text: 'Player attacked Enemy', type: 'attack', timestamp: Date.now() }],
      };

      logDebugCombatResult(false, view as GameView);

      expect(spy).not.toHaveBeenCalled();
    });

    it('does not call console.log when combatLog is empty', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const view: Partial<GameView> = {
        player: { health: 80 } as any,
        combatLog: [],
      };

      logDebugCombatResult(true, view as GameView);

      expect(spy).not.toHaveBeenCalled();
    });

    it('calls console.log with valid log entry', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const view: Partial<GameView> = {
        player: { health: 80 } as any,
        combatLog: [{ text: 'Player attacked Enemy', type: 'attack', timestamp: Date.now() }],
      };

      logDebugCombatResult(true, view as GameView);

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith('[DEBUG] Combat Result:', expect.any(Object));
    });
  });
});
