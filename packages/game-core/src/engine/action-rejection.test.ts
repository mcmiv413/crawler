/**
 * Test layer: unit
 * Behavior: rejectPlayerAction returns a PLAYER_ACTION_REJECTED result that preserves state and carries action, reason, timing, and optional context details.
 * Proof: Assertions check one PLAYER_ACTION_REJECTED event with actionType/actionId/reasonCode/message/playerId, timestamp and turnNumber equal to state.turnNumber, no ABILITY_USED/ITEM_USED/ATTACK_PERFORMED events, runEnded false, optional target/item/ability/source fields, unchanged player values, and the same state reference.
 * Validation: pnpm vitest run packages/game-core/src/engine/action-rejection.test.ts
 */
import { describe, it, expect } from 'vitest';
import { rejectPlayerAction } from './action-rejection.js';
import { createTestGameState } from '../test-utils.js';
import { entityId } from '@dungeon/contracts';

describe('rejectPlayerAction', () => {
  it('emits PLAYER_ACTION_REJECTED event', () => {
    const state = createTestGameState();
    const playerId = state.player.id;

    const result = rejectPlayerAction(
      state,
      'ABILITY',
      'test-ability',
      'INVALID_TARGET',
      'Target is not valid for this ability',
      playerId,
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: 'PLAYER_ACTION_REJECTED',
      actionType: 'ABILITY',
      actionId: 'test-ability',
      reasonCode: 'INVALID_TARGET',
      message: 'Target is not valid for this ability',
      playerId,
    });
  });

  it('preserves state object values', () => {
    const state = createTestGameState();
    const playerId = state.player.id;
    const originalPlayerHp = state.player.stats.maxHealth;
    const originalPlayerPos = state.player.position;

    rejectPlayerAction(
      state,
      'ITEM',
      'test-item',
      'INSUFFICIENT_RESOURCE',
      'Not enough mana',
      playerId,
    );

    expect(state.player.stats.maxHealth).toBe(originalPlayerHp);
    expect(state.player.position).toEqual(originalPlayerPos);
  });

  it('includes timestamp and turn number', () => {
    const state = createTestGameState();
    const playerId = state.player.id;

    const result = rejectPlayerAction(
      state,
      'ABILITY',
      'test-ability',
      'TEST_REASON',
      'Test message',
      playerId,
    );

    const event = result.events[0];
    if (event && event.type === 'PLAYER_ACTION_REJECTED') {
      expect(event.timestamp).toBe(state.turnNumber);
      expect(event.turnNumber).toBe(state.turnNumber);
    }
  });

  it('does not emit success events', () => {
    const state = createTestGameState();
    const playerId = state.player.id;

    const result = rejectPlayerAction(
      state,
      'ABILITY',
      'test-ability',
      'TEST_REASON',
      'Test message',
      playerId,
    );

    const eventTypes = result.events.map((e) => e.type);
    expect(eventTypes).not.toContain('ABILITY_USED');
    expect(eventTypes).not.toContain('ITEM_USED');
    expect(eventTypes).not.toContain('ATTACK_PERFORMED');
  });

  it('does not end run', () => {
    const state = createTestGameState();
    const playerId = state.player.id;

    const result = rejectPlayerAction(
      state,
      'ABILITY',
      'test-ability',
      'TEST_REASON',
      'Test message',
      playerId,
    );

    expect(result.runEnded).toBe(false);
  });

  it('includes optional context fields when provided', () => {
    const state = createTestGameState();
    const playerId = state.player.id;
    const targetId = entityId('enemy-1');

    const result = rejectPlayerAction(
      state,
      'ABILITY',
      'test-ability',
      'INVALID_TARGET',
      'Target is not valid',
      playerId,
      {
        targetId,
        itemId: 'test-item',
        abilityId: 'test-ability',
        source: 'COMMAND_HANDLER',
      },
    );

    const event = result.events[0];
    if (event && event.type === 'PLAYER_ACTION_REJECTED') {
      expect(event.targetId).toBe(targetId);
      expect(event.itemId).toBe('test-item');
      expect(event.abilityId).toBe('test-ability');
      expect(event.source).toBe('COMMAND_HANDLER');
    }
  });

  it('returns same state reference', () => {
    const state = createTestGameState();
    const playerId = state.player.id;

    const result = rejectPlayerAction(
      state,
      'ABILITY',
      'test-ability',
      'TEST_REASON',
      'Test message',
      playerId,
    );

    expect(result.state).toBe(state);
  });
});
