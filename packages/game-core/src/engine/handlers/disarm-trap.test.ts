/**
 * Test layer: unit
 * Behavior: handleDisarmTrap rejects invalid trap disarms without advancing the turn and converts an adjacent trap into loot while removing it from the floor on success.
 * Proof: Assertions check PLAYER_ACTION_REJECTED reasonCode WRONG_PHASE/NO_TRAP_TARGET with unchanged state, inventory, objects, turnNumber, and runEnded; successful disarms emit TRAP_DISARMED and LOOT_ACQUIRED, remove the trap object, increase inventory length, advance turnNumber, and omit PLAYER_ACTION_REJECTED.
 * Validation: pnpm vitest run packages/game-core/src/engine/handlers/disarm-trap.test.ts
 */
/**
 * Tests for trap disarm action observability (Phase 4B).
 *
 * Proves:
 * - Invalid disarm emits PLAYER_ACTION_REJECTED with stable reason codes
 * - Successful disarm emits TRAP_DISARMED
 * - Rejected disarm preserves inventory and floor state without advancing turn
 * - Successful disarm mutates inventory/floor and advances turn
 */

import { describe, it, expect } from 'vitest';
import { handleDisarmTrap } from './disarm-trap.js';
import { createTestGameStateInCombat } from '../../test-utils.js';
import { SeededRNG } from '../../utils/rng.js';
import type { GameState, DomainEvent } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';
import { WRONG_PHASE, NO_TRAP_TARGET } from '../rejection-codes.js';

function getTrapDisarmedEvent(
  events: readonly DomainEvent[],
): Extract<DomainEvent, { type: 'TRAP_DISARMED' }> | undefined {
  return events.find(
    (event): event is Extract<DomainEvent, { type: 'TRAP_DISARMED' }> => event.type === 'TRAP_DISARMED',
  );
}

function getPlayerActionRejectedEvent(
  events: readonly DomainEvent[],
): Extract<DomainEvent, { type: 'PLAYER_ACTION_REJECTED' }> | undefined {
  return events.find(
    (event): event is Extract<DomainEvent, { type: 'PLAYER_ACTION_REJECTED' }> =>
      event.type === 'PLAYER_ACTION_REJECTED',
  );
}

describe('handleDisarmTrap - trap disarm observability (Phase 4B)', () => {
  describe('invalid disarm rejection', () => {
    it('emits PLAYER_ACTION_REJECTED with WRONG_PHASE when not in dungeon', () => {
      const state = createTestGameStateInCombat();
      // Force town phase
      const townState: GameState = {
        ...state,
        run: null,
        phase: 'town',
      };
      const rng = new SeededRNG(42);

      const result = handleDisarmTrap(townState, 'N', rng);

      const rejected = getPlayerActionRejectedEvent(result.events);
      expect(rejected).toBeDefined();
      expect(rejected?.actionType).toBe('DISARM_TRAP');
      expect(rejected?.actionId).toBe('DISARM_TRAP');
      expect(rejected?.reasonCode).toBe(WRONG_PHASE);
      expect(rejected?.message.length).toBeGreaterThan(0);

      // No trap disarmed event
      expect(getTrapDisarmedEvent(result.events)).toBeUndefined();

      // State unchanged
      expect(result.state).toBe(townState);
      expect(result.state.turnNumber).toBe(townState.turnNumber);
      expect(result.runEnded).toBe(false);
    });

    it('emits PLAYER_ACTION_REJECTED with NO_TRAP_TARGET when adjacent tile is empty', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const rng = new SeededRNG(42);

      const result = handleDisarmTrap(state, 'N', rng);

      const rejected = getPlayerActionRejectedEvent(result.events);
      expect(rejected).toBeDefined();
      expect(rejected?.actionType).toBe('DISARM_TRAP');
      expect(rejected?.reasonCode).toBe(NO_TRAP_TARGET);
      expect(rejected?.message.length).toBeGreaterThan(0);

      // No trap disarmed event
      expect(getTrapDisarmedEvent(result.events)).toBeUndefined();

      // State and inventory unchanged
      expect(result.state.player.inventory).toEqual(state.player.inventory);
      expect(result.state.run?.objects.size).toBe(state.run?.objects.size ?? 0);
      expect(result.state.turnNumber).toBe(state.turnNumber);
      expect(result.runEnded).toBe(false);
    });

    it('does not advance turn or process enemy turns on rejected disarm', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const rng = new SeededRNG(42);

      const result = handleDisarmTrap(state, 'N', rng);

      expect(result.events.some((e) => e.type === 'ENEMY_MOVED')).toBe(false);
      expect(result.events.some((e) => e.type === 'MANA_CHANGED')).toBe(false);
      expect(result.state).toBe(state);
      expect(result.state.turnNumber).toBe(state.turnNumber);
    });
  });

  describe('successful disarm', () => {
    it('emits TRAP_DISARMED with trap and item information', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      // Place a spike trap to the north
      const trapPos = { x: state.player.position.x, y: state.player.position.y - 1 };
      const trapKey = posKey(trapPos);
      const trapId = entityId('spike_trap_1');

      const stateWithTrap: GameState = {
        ...state,
        run: {
          ...state.run!,
          objects: new Map([
            [
              trapKey,
              {
                id: trapId,
                templateId: 'trap_spikes',
                position: trapPos,
                isExhausted: false,
              },
            ],
          ]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleDisarmTrap(stateWithTrap, 'N', rng);

      const disarmed = getTrapDisarmedEvent(result.events);
      expect(disarmed).toBeDefined();
      expect(disarmed?.trapObjectId).toBe(trapId);
      expect(disarmed?.trapName.length).toBeGreaterThan(0);
      expect(disarmed?.position).toEqual(trapPos);
      expect(disarmed?.recoveredItemId.length).toBeGreaterThan(0);
      expect(disarmed?.recoveredItemName.length).toBeGreaterThan(0);
      expect(disarmed?.playerId).toBe(state.player.id);

      // No rejection event
      expect(getPlayerActionRejectedEvent(result.events)).toBeUndefined();

      // Must have inventory change (LOOT_ACQUIRED)
      expect(result.events.some((e) => e.type === 'LOOT_ACQUIRED')).toBe(true);

      // Turn advanced
      expect(result.state.turnNumber).toBeGreaterThan(stateWithTrap.turnNumber);
    });

    it('removes trap from floor objects', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapPos = { x: state.player.position.x, y: state.player.position.y - 1 };
      const trapKey = posKey(trapPos);
      const trapId = entityId('spike_trap_1');

      const stateWithTrap: GameState = {
        ...state,
        run: {
          ...state.run!,
          objects: new Map([
            [
              trapKey,
              {
                id: trapId,
                templateId: 'trap_spikes',
                position: trapPos,
                isExhausted: false,
              },
            ],
          ]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleDisarmTrap(stateWithTrap, 'N', rng);

      expect(result.state.run?.objects.has(trapKey)).toBe(false);
    });

    it('adds recovered trap item to inventory', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const inventorySizeBefore = state.player.inventory.length;
      const trapPos = { x: state.player.position.x, y: state.player.position.y - 1 };
      const trapKey = posKey(trapPos);

      const stateWithTrap: GameState = {
        ...state,
        run: {
          ...state.run!,
          objects: new Map([
            [
              trapKey,
              {
                id: entityId('spike_trap_1'),
                templateId: 'trap_spikes',
                position: trapPos,
                isExhausted: false,
              },
            ],
          ]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleDisarmTrap(stateWithTrap, 'N', rng);

      expect(result.state.player.inventory.length).toBeGreaterThan(inventorySizeBefore);
    });

    it('advances turn and processes enemy turns on successful disarm', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const turnBefore = state.turnNumber;
      const trapPos = { x: state.player.position.x, y: state.player.position.y - 1 };
      const trapKey = posKey(trapPos);

      const stateWithTrap: GameState = {
        ...state,
        run: {
          ...state.run!,
          objects: new Map([
            [
              trapKey,
              {
                id: entityId('spike_trap_1'),
                templateId: 'trap_spikes',
                position: trapPos,
                isExhausted: false,
              },
            ],
          ]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleDisarmTrap(stateWithTrap, 'N', rng);

      expect(result.state.turnNumber).toBeGreaterThan(turnBefore);
      // Enemy turns may produce events
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('does not emit PLAYER_ACTION_REJECTED on successful disarm', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapPos = { x: state.player.position.x, y: state.player.position.y - 1 };
      const trapKey = posKey(trapPos);

      const stateWithTrap: GameState = {
        ...state,
        run: {
          ...state.run!,
          objects: new Map([
            [
              trapKey,
              {
                id: entityId('spike_trap_1'),
                templateId: 'trap_spikes',
                position: trapPos,
                isExhausted: false,
              },
            ],
          ]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleDisarmTrap(stateWithTrap, 'N', rng);

      expect(getPlayerActionRejectedEvent(result.events)).toBeUndefined();
    });
  });
});
