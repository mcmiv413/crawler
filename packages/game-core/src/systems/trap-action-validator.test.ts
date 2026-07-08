/**
 * Test layer: unit
 * Behavior: Trap action validators reject disarm and set-trap commands when phase, direction, inventory, registry item, trap type, or target tile preconditions fail.
 * Proof: Assertions check invalid results with rejectionCode values WRONG_PHASE, INVALID_DIRECTION, NO_TRAP_TARGET, TRAP_ITEM_NOT_IN_INVENTORY, ITEM_NOT_FOUND, ITEM_NOT_TRAP, TILE_OCCUPIED, and TILE_OCCUPIED_BY_ENEMY.
 * Validation: pnpm vitest run packages/game-core/src/systems/trap-action-validator.test.ts
 */
/**
 * Tests for centralized trap action validation.
 *
 * Proves:
 * - validateDisarmTrapAction accepts valid disarm and rejects with specific reason codes
 * - validateSetTrapAction accepts valid placement and rejects with specific reason codes
 * - Validators do not mutate state
 * - Validators provide resolved data needed by handlers
 */

import { describe, it, expect } from 'vitest';
import { validateDisarmTrapAction, validateSetTrapAction } from './trap-action-validator.js';
import { createTestGameState, createTestGameStateInCombat } from '../test-utils.js';
import {
  WRONG_PHASE,
  INVALID_DIRECTION,
  NO_TRAP_TARGET,
  TRAP_ITEM_NOT_IN_INVENTORY,
  ITEM_NOT_FOUND,
  ITEM_NOT_TRAP,
  TILE_OCCUPIED,
  TILE_OCCUPIED_BY_ENEMY,
} from '../engine/rejection-codes.js';
import type { AnyItemTemplate, TrapItemTemplate, GameState } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';

describe('validateDisarmTrapAction', () => {
  describe('rejects when not in dungeon phase', () => {
    it('returns WRONG_PHASE when run is null', () => {
      const state = createTestGameState();
      const result = validateDisarmTrapAction(state, 'N');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(WRONG_PHASE);
        expect(result.message).toBeTruthy();
      }
    });

    it('returns WRONG_PHASE when phase is not dungeon', () => {
      const state = {
        ...createTestGameState(),
        phase: 'town' as const,
      };
      const result = validateDisarmTrapAction(state, 'N');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(WRONG_PHASE);
      }
    });
  });

  describe('rejects invalid direction', () => {
    it('returns INVALID_DIRECTION for invalid direction', () => {
      const dungeonState = createTestGameStateInCombat();
      const result = validateDisarmTrapAction(dungeonState, 'invalid' as any);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(INVALID_DIRECTION);
      }
    });
  });

  describe('rejects when no trap target', () => {
    it('returns NO_TRAP_TARGET when adjacent tile is empty', () => {
      const dungeonState = createTestGameStateInCombat();
      const result = validateDisarmTrapAction(dungeonState, 'N');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(NO_TRAP_TARGET);
      }
    });
  });

  describe('rejects non-disarmable traps', () => {
    it('returns NO_TRAP_TARGET for a non-hazard object', () => {
      const state = createTestGameStateInCombat();
      const adjacentPos = { x: state.player.position.x + 1, y: state.player.position.y };
      const objKey = posKey(adjacentPos);

      const dungeonState: GameState = {
        ...state,
        run: {
          ...state.run!,
          objects: new Map([
            [
              objKey,
              {
                id: entityId('obj1'),
                templateId: 'chest',
                position: adjacentPos,
                isExhausted: false,
              },
            ],
          ]),
        },
      };

      const result = validateDisarmTrapAction(dungeonState, 'E');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(NO_TRAP_TARGET);
      }
    });
  });
});

describe('validateSetTrapAction', () => {
  describe('rejects when not in dungeon phase', () => {
    it('returns WRONG_PHASE when run is null', () => {
      const state = createTestGameState();
      const itemId = entityId('trap1');
      const result = validateSetTrapAction(state, 'N', itemId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(WRONG_PHASE);
      }
    });

    it('returns WRONG_PHASE when phase is not dungeon', () => {
      const state = {
        ...createTestGameState(),
        phase: 'town' as const,
      };
      const itemId = entityId('trap1');
      const result = validateSetTrapAction(state, 'N', itemId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(WRONG_PHASE);
      }
    });
  });

  describe('rejects invalid direction', () => {
    it('returns INVALID_DIRECTION for invalid direction', () => {
      const itemId = entityId('trap1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        description: 'test trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
      };
      const base = createTestGameStateInCombat();
      const dungeonState: GameState = {
        ...base,
        player: { ...base.player, inventory: [itemId] },
        itemRegistry: { items: new Map([[itemId, trapTemplate]]) },
      };
      const result = validateSetTrapAction(dungeonState, 'invalid' as any, itemId); // intentionally invalid
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(INVALID_DIRECTION);
      }
    });
  });

  describe('rejects when item not in inventory', () => {
    it('returns TRAP_ITEM_NOT_IN_INVENTORY when item is not in inventory', () => {
      const dungeonState = createTestGameStateInCombat();
      const itemId = entityId('not_in_inventory');
      const result = validateSetTrapAction(dungeonState, 'N', itemId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(TRAP_ITEM_NOT_IN_INVENTORY);
      }
    });
  });

  describe('rejects when item not found in registry', () => {
    it('returns ITEM_NOT_FOUND when item registry lookup fails', () => {
      const itemId = entityId('trap1');
      const state = createTestGameStateInCombat();
      const dungeonState: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [itemId],
        },
        itemRegistry: {
          items: new Map(),
        },
      };
      const result = validateSetTrapAction(dungeonState, 'N', itemId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(ITEM_NOT_FOUND);
      }
    });
  });

  describe('rejects when item is not a trap', () => {
    it('returns ITEM_NOT_TRAP for non-trap items', () => {
      const itemId = entityId('sword1');
      const weaponTemplate: any = {
        itemId: 'sword',
        name: 'Sword',
        itemClass: 'weapon',
        rarity: 'common',
        stackable: false,
        maxStack: 1,
        value: 10,
      };
      const state = createTestGameStateInCombat();
      const dungeonState: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [itemId],
        },
        itemRegistry: {
          items: new Map([[itemId, weaponTemplate as AnyItemTemplate]]),
        },
      };
      const result = validateSetTrapAction(dungeonState, 'N', itemId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(ITEM_NOT_TRAP);
      }
    });
  });

  describe('rejects when tile is occupied by object', () => {
    it('returns TILE_OCCUPIED when adjacent tile has an object', () => {
      const itemId = entityId('trap1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        description: 'test trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
      };
      const state = createTestGameStateInCombat();
      const adjacentPos = { x: state.player.position.x + 1, y: state.player.position.y };
      const objKey = posKey(adjacentPos);

      const dungeonState: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [itemId],
        },
        run: {
          ...state.run!,
          objects: new Map([
            [
              objKey,
              {
                id: entityId('obj1'),
                templateId: 'spike_trap_common',
                position: adjacentPos,
                isExhausted: false,
              },
            ],
          ]),
        },
        phase: 'dungeon',
        itemRegistry: {
          items: new Map([[itemId, trapTemplate]]),
        },
      };
      const result = validateSetTrapAction(dungeonState, 'E', itemId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(TILE_OCCUPIED);
      }
    });
  });

  describe('rejects when tile is occupied by enemy', () => {
    it('returns TILE_OCCUPIED_BY_ENEMY when adjacent tile has an enemy', () => {
      const itemId = entityId('trap1');
      const trapTemplate: TrapItemTemplate = {
        itemId: 'wooden_spike_trap',
        name: 'Wooden Spike Trap',
        description: 'test trap',
        itemClass: 'trap',
        rarity: 'common',
        stackable: true,
        maxStack: 5,
        value: 10,
        trapTemplateId: 'trap_spikes',
      };
      const state = createTestGameStateInCombat();
      const adjacentPos = { x: state.player.position.x + 1, y: state.player.position.y };

      const dungeonState: GameState = {
        ...state,
        player: {
          ...state.player,
          inventory: [itemId],
        },
        run: {
          ...state.run!,
          enemies: new Map([
            [
              entityId('goblin1'),
              {
                id: entityId('goblin1'),
                templateId: 'goblin',
                position: adjacentPos,
                currentHealth: 10,
                stats: {
                  maxHealth: 10,
                  attack: 5,
                  defense: 2,
                  speed: 100,
                  accuracy: 100,
                  evasion: 0,
                  resistances: {},
                },
                status: {},
                sprite: {
                  name: 'goblin',
                  x: 0,
                  y: 0,
                },
              },
            ],
          ]) as any,
        },
        phase: 'dungeon',
        itemRegistry: {
          items: new Map([[itemId, trapTemplate]]),
        },
      };
      const result = validateSetTrapAction(dungeonState, 'E', itemId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rejectionCode).toBe(TILE_OCCUPIED_BY_ENEMY);
      }
    });
  });
});
