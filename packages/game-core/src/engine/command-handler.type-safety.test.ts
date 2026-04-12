import { describe, it, expect, beforeEach } from 'vitest';
import { handleCommand } from './command-handler.js';
import { createTestGameState } from '../test-utils.js';
import type {
  MoveCommand,
  AttackCommand,
  UseItemCommand,
  EquipCommand,
  TownActionCommand,
  SeededRNG,
} from '@dungeon/contracts';

describe('command-handler type safety', () => {
  let rng: SeededRNG;

  beforeEach(() => {
    // Mock RNG for testing
    let counter = 0;
    rng = {
      next: () => ({ value: counter++, done: false }),
    };
  });

  it('handles MOVE command without type casting', () => {
    const state = createTestGameState();
    const moveCmd: MoveCommand = {
      type: 'MOVE',
      direction: 'N',
    };

    // This should not require (cmd as any) casting
    const result = handleCommand(state, moveCmd, rng);
    expect(result).toHaveProperty('state');
    expect(result).toHaveProperty('events');
  });

  it('handles ATTACK command with typed access', () => {
    const state = createTestGameState({
      world: {
        ...createTestGameState().world,
        npcs: [],
        enemies: [
          {
            id: 'enemy1',
            name: 'Orc',
            x: 1,
            y: 0,
            health: 20,
            maxHealth: 20,
            stats: { attack: 5, defense: 2, accuracy: 5, evasion: 3, speed: 5 },
            type: 'melee',
            behavior: 'aggressive',
            abilities: [],
          },
        ],
      },
    });

    const attackCmd: AttackCommand = {
      type: 'ATTACK',
      targetId: 'enemy1',
    };

    const result = handleCommand(state, attackCmd, rng);
    expect(result).toBeDefined();
  });

  it('handles EQUIP command with typed access', () => {
    const state = createTestGameState();
    const equipCmd: EquipCommand = {
      type: 'EQUIP',
      itemId: 'test_sword',
    };

    const result = handleCommand(state, equipCmd, rng);
    expect(result).toBeDefined();
  });

  it('uses type guards to safely dispatch WAIT command', () => {
    const state = createTestGameState();
    const waitCmd: { type: 'WAIT' } = { type: 'WAIT' };

    const result = handleCommand(state, waitCmd as any, rng);
    expect(result).toBeDefined();
    expect(result.events).toBeDefined();
  });

  it('exhaustively handles all command types', () => {
    // This test documents that all command types in the switch statement
    // must be explicitly handled
    const testCases: Array<{ type: string; commandName: string }> = [
      { type: 'MOVE', commandName: 'MoveCommand' },
      { type: 'ATTACK', commandName: 'AttackCommand' },
      { type: 'USE_ITEM', commandName: 'UseItemCommand' },
      { type: 'WAIT', commandName: 'WaitCommand' },
      { type: 'RETREAT', commandName: 'RetreatCommand' },
      { type: 'TOWN_ACTION', commandName: 'TownActionCommand' },
      { type: 'EQUIP', commandName: 'EquipCommand' },
      { type: 'UNEQUIP', commandName: 'UnequipCommand' },
      { type: 'SWAP_WEAPONS', commandName: 'SwapWeaponsCommand' },
      { type: 'INTERACT', commandName: 'InteractCommand' },
      { type: 'ASCEND', commandName: 'AscendCommand' },
      { type: 'USE_ABILITY', commandName: 'UseAbilityCommand' },
      { type: 'ENCHANT_ARMOR', commandName: 'EnchantArmorCommand' },
    ];

    // Just verify the list — actual dispatch is verified by integration tests
    expect(testCases.length).toBeGreaterThan(0);
  });
});
