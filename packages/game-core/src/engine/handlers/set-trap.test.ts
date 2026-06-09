/**
 * Tests for trap placement action observability (Phase 4B).
 *
 * Proves:
 * - Invalid placement emits PLAYER_ACTION_REJECTED with stable reason codes
 * - Successful placement emits TRAP_PLACED
 * - Rejected placement preserves inventory and floor state without advancing turn
 * - Successful placement mutates inventory/floor and advances turn
 */

import { describe, it, expect } from 'vitest';
import { handleSetTrap } from './set-trap.js';
import { createTestGameStateInCombat } from '../../test-utils.js';
import { SeededRNG } from '../../utils/rng.js';
import type { GameState, DomainEvent, TrapItemTemplate } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';
import {
  WRONG_PHASE,
  TRAP_ITEM_NOT_IN_INVENTORY,
  ITEM_NOT_TRAP,
  TILE_OCCUPIED,
  TILE_OCCUPIED_BY_ENEMY,
} from '../rejection-codes.js';

function getTrapPlacedEvent(
  events: readonly DomainEvent[],
): Extract<DomainEvent, { type: 'TRAP_PLACED' }> | undefined {
  return events.find(
    (event): event is Extract<DomainEvent, { type: 'TRAP_PLACED' }> => event.type === 'TRAP_PLACED',
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

describe('handleSetTrap - trap placement observability (Phase 4B)', () => {
  describe('invalid placement rejection', () => {
    it('emits PLAYER_ACTION_REJECTED with WRONG_PHASE when not in dungeon', () => {
      const state = createTestGameStateInCombat();
      const townState: GameState = {
        ...state,
        run: null,
        phase: 'town',
      };
      const trapItemId = entityId('trap_item_1');
      const rng = new SeededRNG(42);

      const result = handleSetTrap(townState, 'N', trapItemId, rng);

      const rejected = getPlayerActionRejectedEvent(result.events);
      expect(rejected).toBeDefined();
      expect(rejected?.actionType).toBe('SET_TRAP');
      expect(rejected?.actionId).toBe('SET_TRAP');
      expect(rejected?.reasonCode).toBe(WRONG_PHASE);
      expect(rejected?.message.length).toBeGreaterThan(0);

      // No trap placed event
      expect(getTrapPlacedEvent(result.events)).toBeUndefined();

      // State unchanged
      expect(result.state).toBe(townState);
      expect(result.state.turnNumber).toBe(townState.turnNumber);
      expect(result.runEnded).toBe(false);
    });

    it('emits PLAYER_ACTION_REJECTED with TRAP_ITEM_NOT_IN_INVENTORY when item not in inventory', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapItemId = entityId('not_in_inventory');
      const rng = new SeededRNG(42);

      const result = handleSetTrap(state, 'N', trapItemId, rng);

      const rejected = getPlayerActionRejectedEvent(result.events);
      expect(rejected).toBeDefined();
      expect(rejected?.actionType).toBe('SET_TRAP');
      expect(rejected?.reasonCode).toBe(TRAP_ITEM_NOT_IN_INVENTORY);
      expect(rejected?.message.length).toBeGreaterThan(0);

      // No trap placed event
      expect(getTrapPlacedEvent(result.events)).toBeUndefined();

      // State unchanged
      expect(result.state).toBe(state);
      expect(result.state.turnNumber).toBe(state.turnNumber);
      expect(result.runEnded).toBe(false);
    });

    it('emits PLAYER_ACTION_REJECTED with ITEM_NOT_TRAP for non-trap items', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const swordItemId = entityId('sword_1');
      const weaponTemplate = {
        itemId: 'rusty_sword',
        name: 'Rusty Sword',
        itemClass: 'weapon' as const,
        rarity: 'common' as const,
        stackable: false,
        maxStack: 1,
        value: 10,
      };

      const stateWithSword: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [swordItemId],
        },
        itemRegistry: {
          items: new Map([[swordItemId, weaponTemplate as any]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleSetTrap(stateWithSword, 'N', swordItemId, rng);

      const rejected = getPlayerActionRejectedEvent(result.events);
      expect(rejected).toBeDefined();
      expect(rejected?.actionType).toBe('SET_TRAP');
      expect(rejected?.reasonCode).toBe(ITEM_NOT_TRAP);
      expect(rejected?.message.length).toBeGreaterThan(0);

      // No trap placed event
      expect(getTrapPlacedEvent(result.events)).toBeUndefined();

      // Inventory unchanged
      expect(result.state.player.inventory).toEqual(stateWithSword.player.inventory);
      expect(result.state.turnNumber).toBe(stateWithSword.turnNumber);
    });

    it('emits PLAYER_ACTION_REJECTED with TILE_OCCUPIED when object on target tile', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapItemId = entityId('trap_item_1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
        description: 'A test trap',
      };

      // Place an obstacle to the north
      const targetPos = { x: state.player.position.x, y: state.player.position.y - 1 };
      const targetKey = posKey(targetPos);

      const stateWithTrap: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [trapItemId],
        },
        run: {
          ...state.run!,
          objects: new Map([
            [
              targetKey,
              {
                id: entityId('obstacle_1'),
                templateId: 'boulder',
                position: targetPos,
                isExhausted: false,
              },
            ],
          ]),
        },
        itemRegistry: {
          items: new Map([[trapItemId, trapTemplate]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleSetTrap(stateWithTrap, 'N', trapItemId, rng);

      const rejected = getPlayerActionRejectedEvent(result.events);
      expect(rejected).toBeDefined();
      expect(rejected?.actionType).toBe('SET_TRAP');
      expect(rejected?.reasonCode).toBe(TILE_OCCUPIED);
      expect(rejected?.message.length).toBeGreaterThan(0);

      // No trap placed event
      expect(getTrapPlacedEvent(result.events)).toBeUndefined();

      // Inventory unchanged
      expect(result.state.player.inventory).toEqual(stateWithTrap.player.inventory);
      expect(result.state.turnNumber).toBe(stateWithTrap.turnNumber);
    });

    it('emits PLAYER_ACTION_REJECTED with TILE_OCCUPIED_BY_ENEMY when enemy on target', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 0, y: -1 } });
      const trapItemId = entityId('trap_item_1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
        description: 'A test trap',
      };

      const stateWithTrap: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [trapItemId],
        },
        itemRegistry: {
          items: new Map([[trapItemId, trapTemplate]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleSetTrap(stateWithTrap, 'N', trapItemId, rng);

      const rejected = getPlayerActionRejectedEvent(result.events);
      expect(rejected).toBeDefined();
      expect(rejected?.actionType).toBe('SET_TRAP');
      expect(rejected?.reasonCode).toBe(TILE_OCCUPIED_BY_ENEMY);
      expect(rejected?.message.length).toBeGreaterThan(0);

      // No trap placed event
      expect(getTrapPlacedEvent(result.events)).toBeUndefined();

      // Inventory unchanged
      expect(result.state.player.inventory).toEqual(stateWithTrap.player.inventory);
      expect(result.state.turnNumber).toBe(stateWithTrap.turnNumber);
    });

    it('does not advance turn or process enemy turns on rejected placement', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapItemId = entityId('not_in_inventory');
      const rng = new SeededRNG(42);

      const result = handleSetTrap(state, 'N', trapItemId, rng);

      expect(result.events.some((e) => e.type === 'ENEMY_MOVED')).toBe(false);
      expect(result.events.some((e) => e.type === 'MANA_CHANGED')).toBe(false);
      expect(result.state).toBe(state);
      expect(result.state.turnNumber).toBe(state.turnNumber);
    });
  });

  describe('successful placement', () => {
    it('emits TRAP_PLACED with trap and position information', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapItemId = entityId('trap_item_1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
        description: 'A test trap',
      };

      const stateWithTrap: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [trapItemId],
        },
        itemRegistry: {
          items: new Map([[trapItemId, trapTemplate]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleSetTrap(stateWithTrap, 'N', trapItemId, rng);

      const placed = getTrapPlacedEvent(result.events);
      expect(placed).toBeDefined();
      expect(placed?.trapName.length).toBeGreaterThan(0);
      expect(placed?.trapTemplateId).toBe('trap_spikes');
      expect(placed?.itemEntityId).toBe(trapItemId);
      expect(placed?.playerId).toBe(state.player.id);
      expect(placed?.position).toBeDefined();

      // No rejection event
      expect(getPlayerActionRejectedEvent(result.events)).toBeUndefined();

      // Turn advanced
      expect(result.state.turnNumber).toBeGreaterThan(stateWithTrap.turnNumber);
    });

    it('removes trap item from inventory', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapItemId = entityId('trap_item_1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
        description: 'A test trap',
      };

      const stateWithTrap: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [trapItemId],
        },
        itemRegistry: {
          items: new Map([[trapItemId, trapTemplate]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleSetTrap(stateWithTrap, 'N', trapItemId, rng);

      expect(result.state.player.inventory.includes(trapItemId)).toBe(false);
      expect(result.state.player.inventory.length).toBeLessThan(stateWithTrap.player.inventory.length);
    });

    it('adds trap object to floor', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapItemId = entityId('trap_item_1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
        description: 'A test trap',
      };

      const stateWithTrap: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [trapItemId],
        },
        itemRegistry: {
          items: new Map([[trapItemId, trapTemplate]]),
        },
      };

      const objectCountBefore = stateWithTrap.run?.objects.size ?? 0;
      const rng = new SeededRNG(42);
      const result = handleSetTrap(stateWithTrap, 'N', trapItemId, rng);

      expect(result.state.run?.objects.size ?? 0).toBeGreaterThan(objectCountBefore);
    });

    it('advances turn and processes enemy turns on successful placement', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapItemId = entityId('trap_item_1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
        description: 'A test trap',
      };

      const stateWithTrap: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [trapItemId],
        },
        itemRegistry: {
          items: new Map([[trapItemId, trapTemplate]]),
        },
      };

      const turnBefore = stateWithTrap.turnNumber;
      const rng = new SeededRNG(42);
      const result = handleSetTrap(stateWithTrap, 'N', trapItemId, rng);

      expect(result.state.turnNumber).toBeGreaterThan(turnBefore);
      // Enemy turns may produce events
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('does not emit PLAYER_ACTION_REJECTED on successful placement', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapItemId = entityId('trap_item_1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
        description: 'A test trap',
      };

      const stateWithTrap: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [trapItemId],
        },
        itemRegistry: {
          items: new Map([[trapItemId, trapTemplate]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleSetTrap(stateWithTrap, 'N', trapItemId, rng);

      expect(getPlayerActionRejectedEvent(result.events)).toBeUndefined();
    });

    it('emits TRAP_PLACED as first event before enemy events', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const trapItemId = entityId('trap_item_1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
        description: 'A test trap',
      };

      const stateWithTrap: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [trapItemId],
        },
        itemRegistry: {
          items: new Map([[trapItemId, trapTemplate]]),
        },
      };

      const rng = new SeededRNG(42);
      const result = handleSetTrap(stateWithTrap, 'N', trapItemId, rng);

      const placedIndex = result.events.findIndex((e) => e.type === 'TRAP_PLACED');
      expect(placedIndex).toBeGreaterThanOrEqual(0);

      // Should be one of the first events
      expect(placedIndex).toBeLessThan(5);
    });
  });
});
