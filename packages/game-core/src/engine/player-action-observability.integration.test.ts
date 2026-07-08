/**
 * Test layer: integration
 * Behavior: Player Action Observability covers player-action-observability integration tests; rejection visibility; using item outside combat emits PLAYER_ACTION_REJECTED.
 * Proof: integrated command, service, or repository assertions verify the cross-module result.
 * Validation: pnpm vitest run packages/game-core/src/engine/player-action-observability.integration.test.ts
 */
import { describe, it, expect } from 'vitest';
import { handleCommand } from './command-handler.js';
import { SeededRNG } from '../utils/rng.js';
import { entityId } from '@dungeon/contracts';
import {
  createTestGameStateInCombat,
  createTestGameState,
  createUseItemCommand,
  createMoveCommandWithDirection,
} from '../test-utils.js';
import { formatEvent } from '@dungeon/presenter';

describe('player-action-observability integration tests', () => {
  describe('rejection visibility', () => {
    it('using item outside combat emits PLAYER_ACTION_REJECTED', () => {
      const state = createTestGameState();
      const rng = new SeededRNG(12345);
      const itemId = entityId('healing_potion');

      const result = handleCommand(state, createUseItemCommand(itemId), rng);

      const rejectionEvent = result.events.find((e) => e.type === 'PLAYER_ACTION_REJECTED');
      expect(rejectionEvent).toBeDefined();
      expect(rejectionEvent?.type).toBe('PLAYER_ACTION_REJECTED');
      if (rejectionEvent && rejectionEvent.type === 'PLAYER_ACTION_REJECTED') {
        expect(rejectionEvent.actionType).toBe('ITEM');
        expect(rejectionEvent.actionId).toBe(itemId);
        expect(rejectionEvent.reasonCode).toBe('WRONG_PHASE');
        expect(rejectionEvent.message).toContain('combat');
      }
    });

    it('rejection event is formattable to player-readable text', () => {
      const state = createTestGameState();
      const rng = new SeededRNG(12345);

      const result = handleCommand(state, createUseItemCommand(entityId('healing_potion')), rng);
      const rejectionEvent = result.events.find((e) => e.type === 'PLAYER_ACTION_REJECTED');

      expect(rejectionEvent).toBeDefined();
      const formatted = formatEvent(rejectionEvent!);
      expect(formatted).toBeDefined();
      expect(formatted?.text).toBeTruthy();
      expect(typeof formatted?.text).toBe('string');
      expect(formatted?.text.length).toBeGreaterThan(0);
    });

    it('state remains unchanged after rejection', () => {
      const state = createTestGameState();
      const rng = new SeededRNG(12345);
      const originalTurn = state.turnNumber;
      const originalPhase = state.phase;

      const result = handleCommand(state, createUseItemCommand(entityId('healing_potion')), rng);

      expect(result.state).toBe(state);
      expect(result.state.phase).toBe(originalPhase);
      expect(result.state.turnNumber).toBe(originalTurn);
    });

    it('rejection does not end run', () => {
      const state = createTestGameState();
      const rng = new SeededRNG(12345);

      const result = handleCommand(state, createUseItemCommand(entityId('healing_potion')), rng);

      expect(result.runEnded).toBe(false);
    });
  });

  describe('success visibility', () => {
    it('valid player action does not emit rejection event', () => {
      const state = createTestGameStateInCombat();
      const rng = new SeededRNG(12345);

      const result = handleCommand(state, createMoveCommandWithDirection('E'), rng);

      const rejectionEvent = result.events.find((e) => e.type === 'PLAYER_ACTION_REJECTED');
      expect(rejectionEvent).toBeUndefined();
    });
  });

  describe('movement blocked visibility', () => {
    it('moving off-map emits a formattable MOVEMENT_BLOCKED event without advancing the turn', () => {
      // Player at (0,0); enemy moved away; moving W targets (-1,0) (no cell).
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const rng = new SeededRNG(12345);
      const turnsBefore = state.turnNumber;

      const result = handleCommand(state, createMoveCommandWithDirection('W'), rng);

      const blocked = result.events.find((e) => e.type === 'MOVEMENT_BLOCKED');
      expect(blocked).toBeDefined();
      if (blocked && blocked.type === 'MOVEMENT_BLOCKED') {
        expect(blocked.reasonCode).toBe('OUT_OF_BOUNDS');
        expect(blocked.playerId).toBe(state.player.id);
        const formatted = formatEvent(blocked);
        expect(formatted?.text.length).toBeGreaterThan(0);
      }

      expect(result.events.some((e) => e.type === 'PLAYER_MOVED')).toBe(false);
      expect(result.state.turnNumber).toBe(turnsBefore);
      expect(result.runEnded).toBe(false);
    });
  });

  describe('rejection with context fields', () => {
    it('rejection includes context fields when available', () => {
      const state = createTestGameState();
      const rng = new SeededRNG(12345);
      const itemId = entityId('healing_potion');

      const result = handleCommand(state, createUseItemCommand(itemId), rng);

      const rejectionEvent = result.events.find((e) => e.type === 'PLAYER_ACTION_REJECTED');
      expect(rejectionEvent).toBeDefined();
      if (rejectionEvent && rejectionEvent.type === 'PLAYER_ACTION_REJECTED') {
        expect(rejectionEvent.itemId).toBe('healing_potion');
        expect(rejectionEvent.playerId).toBe(state.player.id);
      }
    });
  });
});
