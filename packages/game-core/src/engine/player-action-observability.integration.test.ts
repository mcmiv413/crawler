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
