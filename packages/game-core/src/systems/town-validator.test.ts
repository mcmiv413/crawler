/**
 * Test layer: unit
 * Behavior: validateTownTransaction accepts valid town actions and rejects invalid spell study, item purchase, and quest turn-in requests with stable reason codes.
 * Proof: Assertions check result.valid, rejectionCode values SPELL_NOT_FOUND, ITEM_NOT_FOR_SALE, INSUFFICIENT_GOLD, QUEST_NOT_FOUND, and QUEST_NOT_READY, nonempty messages, and unchanged gold or quest counts on rejection.
 * Validation: pnpm vitest run packages/game-core/src/systems/town-validator.test.ts
 */
/**
 * Contract tests for the centralized town transaction validator.
 *
 * Proves: allow on valid input, reject on invalid input, stable reason codes,
 * player-readable messages, no state mutation.
 */

import { describe, it, expect } from 'vitest';
import { validateTownTransaction } from './town-validator.js';
import { createTestGameState } from '../test-utils.js';
import {
  SPELL_NOT_FOUND,
  ITEM_NOT_FOR_SALE,
  INSUFFICIENT_GOLD,
  QUEST_NOT_FOUND,
  QUEST_NOT_READY,
} from '../engine/rejection-codes.js';
import { entityId } from '@dungeon/contracts';
import type { Quest } from '@dungeon/contracts';

/** Minimal shop item fixture — ShopItem has only { itemId, price, stock } */
function makeShopItem(itemId: string, price: number, stock: number) {
  return { itemId, price, stock };
}

/** Minimal Quest fixture using only fields in the Quest contract type. */
function makeQuest(id: string, status: Quest['status']): Quest {
  return {
    id,
    title: 'Test Quest',
    description: 'A test quest',
    status,
    objective: { type: 'defeat_enemy', targetId: 'goblin', targetCount: 3, progress: 0 },
    reward: { type: 'gold', amount: 50 },
    giverNpcId: 'elder_npc',
  };
}

describe('validateTownTransaction', () => {
  // ---------------------------------------------------------------------------
  // STUDY_SPELL
  // ---------------------------------------------------------------------------
  describe('STUDY_SPELL', () => {
    it('rejects when spellId is not provided', () => {
      const state = createTestGameState();
      const result = validateTownTransaction(state, 'STUDY_SPELL', {});
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(SPELL_NOT_FOUND);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    it('rejects when spellId does not exist in content', () => {
      const state = createTestGameState();
      const result = validateTownTransaction(state, 'STUDY_SPELL', { spellId: 'nonexistent_spell_xyz' });
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(SPELL_NOT_FOUND);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    it('SPELL_NOT_FOUND has stable reason code', () => {
      const state = createTestGameState();
      const result = validateTownTransaction(state, 'STUDY_SPELL', { spellId: 'bad_id' });
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(SPELL_NOT_FOUND);
      }
    });

    it('does not mutate state on spell rejection', () => {
      const state = createTestGameState();
      const originalGold = state.player.gold;
      validateTownTransaction(state, 'STUDY_SPELL', { spellId: 'bad_id' });
      expect(state.player.gold).toBe(originalGold);
    });
  });

  // ---------------------------------------------------------------------------
  // BUY_ITEM
  // ---------------------------------------------------------------------------
  describe('BUY_ITEM', () => {
    it('rejects when itemId is not provided', () => {
      const state = createTestGameState();
      const result = validateTownTransaction(state, 'BUY_ITEM', {});
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(ITEM_NOT_FOR_SALE);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    it('rejects when item is not in shop', () => {
      const state = createTestGameState();
      const result = validateTownTransaction(state, 'BUY_ITEM', { itemId: 'nonexistent_item' });
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(ITEM_NOT_FOR_SALE);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    it('rejects when player lacks gold', () => {
      const state = createTestGameState({
        world: {
          shop: {
            items: [makeShopItem('health_potion', 9999, 1)],
            buybackMultiplier: 0.4,
          },
        },
      });
      const poorState = {
        ...state,
        player: { ...state.player, gold: 0 },
      };
      const result = validateTownTransaction(poorState, 'BUY_ITEM', { itemId: 'health_potion' });
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(INSUFFICIENT_GOLD);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    it('rejects out of stock items', () => {
      const state = createTestGameState({
        world: {
          shop: {
            items: [makeShopItem('health_potion', 5, 0)],
            buybackMultiplier: 0.4,
          },
        },
      });
      const result = validateTownTransaction(state, 'BUY_ITEM', { itemId: 'health_potion' });
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(ITEM_NOT_FOR_SALE);
      }
    });

    it('allows when item is in stock and player can afford it', () => {
      const state = createTestGameState({
        world: {
          shop: {
            items: [makeShopItem('health_potion', 10, 5)],
            buybackMultiplier: 0.4,
          },
        },
      });
      const richState = {
        ...state,
        player: { ...state.player, gold: 100 },
      };
      const result = validateTownTransaction(richState, 'BUY_ITEM', { itemId: 'health_potion' });
      expect(result.valid).toBe(true);
    });

    it('INSUFFICIENT_GOLD has stable reason code', () => {
      const state = createTestGameState({
        world: {
          shop: {
            items: [makeShopItem('health_potion', 9999, 1)],
            buybackMultiplier: 0.4,
          },
        },
      });
      const poorState = { ...state, player: { ...state.player, gold: 0 } };
      const result = validateTownTransaction(poorState, 'BUY_ITEM', { itemId: 'health_potion' });
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(INSUFFICIENT_GOLD);
      }
    });

    it('does not mutate state on rejection', () => {
      const state = createTestGameState();
      const originalGold = state.player.gold;
      validateTownTransaction(state, 'BUY_ITEM', { itemId: 'nonexistent' });
      expect(state.player.gold).toBe(originalGold);
    });
  });

  // ---------------------------------------------------------------------------
  // TURN_IN_QUEST
  // ---------------------------------------------------------------------------
  describe('TURN_IN_QUEST', () => {
    it('rejects when questId is not provided', () => {
      const state = createTestGameState();
      const result = validateTownTransaction(state, 'TURN_IN_QUEST', {});
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(QUEST_NOT_FOUND);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    it('rejects when quest is not in active quests', () => {
      const state = createTestGameState();
      const result = validateTownTransaction(state, 'TURN_IN_QUEST', { questId: entityId('nonexistent_quest') });
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(QUEST_NOT_FOUND);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    it('rejects when quest is active but not ready to turn in', () => {
      const questId = entityId('q1');
      const activeQuest = makeQuest(questId, 'active');
      const state = {
        ...createTestGameState(),
        activeQuests: [activeQuest],
      };
      const result = validateTownTransaction(state, 'TURN_IN_QUEST', { questId });
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(QUEST_NOT_READY);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    it('allows when quest is ready to turn in', () => {
      const questId = entityId('q2');
      const readyQuest = makeQuest(questId, 'ready_to_turn_in');
      const state = {
        ...createTestGameState(),
        activeQuests: [readyQuest],
      };
      const result = validateTownTransaction(state, 'TURN_IN_QUEST', { questId });
      expect(result.valid).toBe(true);
    });

    it('QUEST_NOT_READY has stable reason code', () => {
      const questId = entityId('q3');
      const activeQuest = makeQuest(questId, 'active');
      const state = { ...createTestGameState(), activeQuests: [activeQuest] };
      const result = validateTownTransaction(state, 'TURN_IN_QUEST', { questId });
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(QUEST_NOT_READY);
      }
    });

    it('does not mutate state on rejection', () => {
      const state = createTestGameState();
      const originalQuestCount = state.activeQuests.length;
      validateTownTransaction(state, 'TURN_IN_QUEST', { questId: entityId('nonexistent') });
      expect(state.activeQuests.length).toBe(originalQuestCount);
    });
  });

  // ---------------------------------------------------------------------------
  // Result contract
  // ---------------------------------------------------------------------------
  describe('result contract', () => {
    it('rejection always has string rejectionCode and message', () => {
      const state = createTestGameState();
      const result = validateTownTransaction(state, 'STUDY_SPELL', { spellId: 'bad' });
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(typeof result.rejectionCode).toBe('string');
        expect(result.rejectionCode.length).toBeGreaterThan(0);
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      }
    });
  });
});
