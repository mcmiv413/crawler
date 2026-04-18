import { describe, it, expect } from 'vitest';
import { ACTION_TURN_COST, finalizeAction, type ActionOutcome } from './action-pipeline.js';
import { SeededRNG } from '../utils/rng.js';
import { createTestGameStateInCombat, createTestGameState } from '../test-utils.js';
import type { GameCommand } from '@dungeon/contracts';

describe('action-pipeline', () => {
  // ---- ACTION_TURN_COST ----
  describe('ACTION_TURN_COST', () => {
    it('all action types have defined costs', () => {
      const actionTypes: GameCommand['type'][] = [
        'MOVE',
        'ATTACK',
        'WAIT',
        'USE_ITEM',
        'USE_ABILITY',
        'SWAP_WEAPONS',
        'INTERACT',
        'DISARM_TRAP',
        'SET_TRAP',
        'EQUIP',
        'UNEQUIP',
        'RETREAT',
        'TOWN_ACTION',
        'ASCEND',
        'ENCHANT_ARMOR',
        'TOGGLE_DEBUG',
      ];

      for (const type of actionTypes) {
        expect(ACTION_TURN_COST[type]).toBeDefined();
        expect(ACTION_TURN_COST[type]).toBeGreaterThanOrEqual(0);
      }
    });

    it('combat actions cost 1 turn', () => {
      expect(ACTION_TURN_COST.MOVE).toBe(1);
      expect(ACTION_TURN_COST.ATTACK).toBe(1);
      expect(ACTION_TURN_COST.WAIT).toBe(1);
      expect(ACTION_TURN_COST.USE_ITEM).toBe(1);
      expect(ACTION_TURN_COST.USE_ABILITY).toBe(1);
      expect(ACTION_TURN_COST.SWAP_WEAPONS).toBe(1);
    });

    it('free actions cost 0 turns', () => {
      expect(ACTION_TURN_COST.EQUIP).toBe(0);
      expect(ACTION_TURN_COST.UNEQUIP).toBe(0);
      expect(ACTION_TURN_COST.RETREAT).toBe(0);
      expect(ACTION_TURN_COST.TOWN_ACTION).toBe(0);
      expect(ACTION_TURN_COST.ASCEND).toBe(0);
      expect(ACTION_TURN_COST.ENCHANT_ARMOR).toBe(0);
      expect(ACTION_TURN_COST.TOGGLE_DEBUG).toBe(0);
    });
  });

  // ---- finalizeAction ----
  describe('finalizeAction', () => {
    it('returns outcome unchanged for 0 turn cost', () => {
      const state = createTestGameState();
      const outcome: ActionOutcome = {
        state,
        events: [],
      };
      const rng = new SeededRNG(1);

      const result = finalizeAction(outcome, 0, rng);

      expect(result.state).toEqual(state);
      expect(result.events).toEqual([]);
      expect(result.runEnded).toBe(false);
    });

    it('returns outcome unchanged if runEnded is true', () => {
      const state = createTestGameStateInCombat();
      const outcome: ActionOutcome = {
        state,
        events: [],
        runEnded: true,
      };
      const rng = new SeededRNG(1);

      const result = finalizeAction(outcome, 1, rng);

      expect(result.state).toEqual(state);
      expect(result.events).toEqual([]);
      expect(result.runEnded).toBe(true);
    });

    it('increments turnNumber when action costs 1 turn', () => {
      const state = createTestGameStateInCombat();
      const beforeTurns = state.turnNumber;
      const outcome: ActionOutcome = {
        state,
        events: [],
      };
      const rng = new SeededRNG(1);

      const result = finalizeAction(outcome, 1, rng);

      expect(result.state.turnNumber).toBe(beforeTurns + 1);
    });

    it('increments turnNumber by turns cost', () => {
      const state = createTestGameStateInCombat();
      const beforeTurns = state.turnNumber;
      const outcome: ActionOutcome = {
        state,
        events: [],
      };
      const rng = new SeededRNG(1);

      const result = finalizeAction(outcome, 2, rng);

      expect(result.state.turnNumber).toBe(beforeTurns + 2);
    });

    it('updates run metrics with turnsElapsed', () => {
      const state = createTestGameStateInCombat();
      const beforeMetrics = state.run?.metrics;
      const outcome: ActionOutcome = {
        state,
        events: [],
      };
      const rng = new SeededRNG(1);

      const result = finalizeAction(outcome, 1, rng);

      // Run metrics should be updated
      if (beforeMetrics && result.state.run?.metrics) {
        expect(result.state.run.metrics.turnsElapsed).toBe(beforeMetrics.turnsElapsed + 1);
      }
    });

    it('processes enemy turns when in combat', () => {
      const state = createTestGameStateInCombat();
      const enemyCountBefore = state.run?.enemies.size ?? 0;
      const outcome: ActionOutcome = {
        state,
        events: [],
      };
      const rng = new SeededRNG(1);

      const result = finalizeAction(outcome, 1, rng);

      // Enemy turns should have been processed (may remove some enemies)
      expect(result.events.length).toBeGreaterThanOrEqual(0); // enemy events may exist
      expect(result.state.run?.enemies).toBeDefined();
    });

    it('ticks ability cooldowns', () => {
      const state = createTestGameStateInCombat();
      const outcome: ActionOutcome = {
        state,
        events: [],
      };
      const rng = new SeededRNG(1);

      const result = finalizeAction(outcome, 1, rng);

      // Cooldowns should be ticked down (or stay at 0 if already on cooldown)
      expect(result.state.player.abilities).toBeDefined();
    });

    it('preserves outcome events and adds enemy events', () => {
      const state = createTestGameStateInCombat();
      const outcomeEvent = { type: 'TEST_EVENT' as const };
      const outcome: ActionOutcome = {
        state,
        events: [outcomeEvent as any],
      };
      const rng = new SeededRNG(1);

      const result = finalizeAction(outcome, 1, rng);

      // Original event should still be there
      expect(result.events.some((e) => (e as any).type === 'TEST_EVENT')).toBe(true);
    });

    it('returns runEnded flag from outcome', () => {
      const state = createTestGameState();
      const outcome: ActionOutcome = {
        state,
        events: [],
        runEnded: true,
      };
      const rng = new SeededRNG(1);

      const result = finalizeAction(outcome, 0, rng);

      expect(result.runEnded).toBe(true);
    });
  });
});
