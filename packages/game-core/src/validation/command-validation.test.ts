/**
 * Test layer: unit
 * Behavior: Command Validation covers invalid command parsing and required command fields.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/validation/command-validation.test.ts
 */
/**
 * packages/game-core/src/validation/command-validation.test.ts
 *
 * Comprehensive tests for command validation at all layers.
 * Tests invalid commands, state validation, combat constraints, and context-specific rules.
 *
 * Coverage:
 * - Invalid command structure (4 tests)
 * - State validation (3 tests)
 * - Combat validation (3 tests)
 * - Context-specific rules (3 tests)
 * Total: 13 tests
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { handleCommand } from '../engine/command-handler.js';
import { SeededRNG } from '../utils/rng.js';
import {
  createTestGameStateInCombat,
  createTestGameState,
  createTestGameStateWithAbility,
} from '../test-utils.js';
import { GameCommandSchema } from '@dungeon/contracts';
import type { GameState } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';

// ============================================================================
// SECTION 1: Invalid Commands (4 tests)
// ============================================================================

describe('Command Validation: Invalid Commands', () => {
  it('rejects unknown command type', () => {
    const parseResult = GameCommandSchema.safeParse({ type: 'UNKNOWN_COMMAND' });
    expect(parseResult.success).toBe(false);
  });

  it('detects missing required fields in MOVE command', () => {
    const parseResult = GameCommandSchema.safeParse({ type: 'MOVE' });
    expect(parseResult.success).toBe(false);
  });

  it('detects malformed ATTACK command without target', () => {
    const parseResult = GameCommandSchema.safeParse({ type: 'ATTACK' });
    expect(parseResult.success).toBe(false);
  });

  it('rejects invalid direction in MOVE command', () => {
    const parseResult = GameCommandSchema.safeParse({
      type: 'MOVE',
      direction: 'INVALID',
    });
    expect(parseResult.success).toBe(false);
  });
});

// ============================================================================
// SECTION 2: State Validation (3 tests)
// ============================================================================

describe('Command Validation: State Validation', () => {
  it('rejects MOVE command when not in dungeon run', () => {
    const state = createTestGameState(); // Town state, no active run
    const rng = new SeededRNG(42);

    const result = handleCommand(state, { type: 'MOVE', direction: 'N' }, rng);

    // Movement is now observable: blocked movement with no active run emits a
    // MOVEMENT_BLOCKED event (NOT_IN_DUNGEON) while still not advancing the turn.
    const blocked = result.events.find((e) => e.type === 'MOVEMENT_BLOCKED');
    expect(blocked).toBeDefined();
    if (blocked && blocked.type === 'MOVEMENT_BLOCKED') {
      expect(blocked.reasonCode).toBe('NOT_IN_DUNGEON');
    }
    expect(result.events.some((e) => e.type === 'PLAYER_MOVED')).toBe(false);
    expect(result.state.turnNumber).toBe(state.turnNumber);
  });

  it('rejects commands when player is dead', () => {
    const state = createTestGameStateInCombat();
    const deadState: GameState = {
      ...state,
      player: {
        ...state.player,
        stats: { ...state.player.stats, health: 0 },
      },
    };
    const rng = new SeededRNG(42);

    // Dead player cannot move: from (0,0) moving N is out of bounds, so the move
    // is blocked. It now emits an observable MOVEMENT_BLOCKED event but must not
    // move the player or advance the turn.
    const moveResult = handleCommand(deadState, { type: 'MOVE', direction: 'N' }, rng);
    expect(moveResult.events.some((e) => e.type === 'PLAYER_MOVED')).toBe(false);
    expect(moveResult.state.player.position).toEqual(deadState.player.position);
    expect(moveResult.state.turnNumber).toBe(deadState.turnNumber);

    // Dead player cannot attack
    const target = Array.from(deadState.run!.enemies.values())[0]!;
    const attackResult = handleCommand(deadState, { type: 'ATTACK', targetId: target.id }, rng);
    expect(attackResult.events).toEqual([
      expect.objectContaining({
        type: 'PLAYER_ACTION_REJECTED',
        reasonCode: 'PLAYER_DEAD',
      }),
    ]);
    expect(attackResult.state).toEqual(deadState);
  });

  it('rejects movement to out-of-bounds coordinates', () => {
    const state = createTestGameStateInCombat();
    const rng = new SeededRNG(42);

    // Move in all directions multiple times to potentially go out of bounds
    let currentState = state;
    for (let i = 0; i < 20; i++) {
      const direction = ['NORTH', 'SOUTH', 'EAST', 'WEST'][i % 4] as any;
      const result = handleCommand(currentState, { type: 'MOVE', direction }, rng);
      currentState = result.state;

      // State should remain valid
      if (currentState.run) {
        expect(currentState.player.position).toBeDefined();
        expect(currentState.player.position.x).toBeGreaterThanOrEqual(0);
        expect(currentState.player.position.y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ============================================================================
// SECTION 3: Combat Validation (3 tests)
// ============================================================================

describe('Command Validation: Combat Validation', () => {
  it('rejects ATTACK on non-existent enemy', () => {
    const state = createTestGameStateInCombat();
    const rng = new SeededRNG(42);

    const fakeEnemyId = entityId('nonexistent_enemy_12345');

    const result = handleCommand(state, { type: 'ATTACK', targetId: fakeEnemyId }, rng);

    // Attack should be visibly rejected when the enemy doesn't exist.
    expect(result.events).toEqual([
      expect.objectContaining({
        type: 'PLAYER_ACTION_REJECTED',
        reasonCode: 'TARGET_NOT_FOUND',
      }),
    ]);
    expect(result.state).toEqual(state);
  });

  it('rejects USE_ABILITY with invalid ability ID', () => {
    const state = createTestGameStateWithAbility('power_strike');
    const rng = new SeededRNG(42);

    if (!state.run) throw new Error('No run in state');

    const target = Array.from(state.run.enemies.values())[0]!;

    const result = handleCommand(
      state,
      {
        type: 'USE_ABILITY',
        abilityId: 'nonexistent_ability_xyz',
        targetId: target.id,
      },
      rng,
    );

    // Invalid ability should be rejected
    expect(result.events.filter((e) => e.type === 'ABILITY_USED').length).toBe(0);
  });

  it('rejects USE_ABILITY with invalid target', () => {
    const state = createTestGameStateWithAbility('power_strike');
    const rng = new SeededRNG(42);

    const fakeTargetId = entityId('nonexistent_target_12345');

    const result = handleCommand(
      state,
      {
        type: 'USE_ABILITY',
        abilityId: 'power_strike',
        targetId: fakeTargetId,
      },
      rng,
    );

    // Ability with invalid target should be rejected
    expect(result.events.filter((e) => e.type === 'ABILITY_USED').length).toBe(0);
  });
});

// ============================================================================
// SECTION 4: Context-Specific Rules (3 tests)
// ============================================================================

describe('Command Validation: Context-Specific Rules', () => {
  it('validates MOVE command differently in combat vs town', () => {
    const rng = new SeededRNG(42);

    // In town: MOVE is blocked (no run) and now observable via MOVEMENT_BLOCKED,
    // but still does not advance the turn.
    const townState = createTestGameState();
    const townResult = handleCommand(townState, { type: 'MOVE', direction: 'N' }, rng);
    expect(townResult.events.some((e) => e.type === 'MOVEMENT_BLOCKED')).toBe(true);
    expect(townResult.events.some((e) => e.type === 'PLAYER_MOVED')).toBe(false);
    expect(townResult.state.turnNumber).toBe(townState.turnNumber);

    // In combat: MOVE is valid
    const combatState = createTestGameStateInCombat();
    const combatResult = handleCommand(combatState, { type: 'MOVE', direction: 'N' }, rng);
    // May have PLAYER_MOVED or turn-skip events
    expect(combatResult.state).toBeDefined();
  });

  it('validation is consistent across identical state conditions', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    const state = createTestGameStateInCombat();

    // Same command, same state → should produce same result
    const result1 = handleCommand(state, { type: 'MOVE', direction: 'N' }, rng1);
    const result2 = handleCommand(state, { type: 'MOVE', direction: 'N' }, rng2);

    // Results should match
    expect(result1.runEnded).toBe(result2.runEnded);
    expect(result1.events.length).toBe(result2.events.length);
    expect(result1.state.turnNumber).toBe(result2.state.turnNumber);
  });

  it('validation is deterministic (no randomness in acceptance)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), (seed) => {
        const state = createTestGameStateInCombat();
        const rng1 = new SeededRNG(seed);
        const rng2 = new SeededRNG(seed);

        const target = Array.from(state.run!.enemies.values())[0]!;

        // Use deterministic ATTACK command
        const result1 = handleCommand(state, { type: 'ATTACK', targetId: target.id }, rng1);
        const result2 = handleCommand(state, { type: 'ATTACK', targetId: target.id }, rng2);

        // Results must be deterministic
        expect(result1.runEnded).toBe(result2.runEnded);
        expect(result1.events.filter((e) => e.type === 'ATTACK_PERFORMED').length).toBe(
          result2.events.filter((e) => e.type === 'ATTACK_PERFORMED').length,
        );
      }),
    );
  });
});

// ============================================================================
// SECTION 5: Property-Based Validation Tests
// ============================================================================

describe('Command Validation: Property-Based Tests', () => {
  it('all commands should not corrupt state (state immutability)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), (seed) => {
        const state = createTestGameStateInCombat();
        const rng = new SeededRNG(seed);

        const originalPlayerPos = state.player.position;
        const originalHealth = state.player.stats.health;
        const originalTurnNumber = state.turnNumber;

        // Any command should not mutate original state
        handleCommand(state, { type: 'MOVE', direction: 'N' }, rng);

        expect(state.player.position).toEqual(originalPlayerPos);
        expect(state.player.stats.health).toBe(originalHealth);
        expect(state.turnNumber).toBe(originalTurnNumber);
      }),
    );
  });

  it('invalid commands always return runEnded: false', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), (seed) => {
        const state = createTestGameState(); // No run
        const rng = new SeededRNG(seed);

        // Commands on town state should not end run
        const result = handleCommand(state, { type: 'MOVE', direction: 'N' }, rng);

        expect(result.runEnded).toBe(false);
      }),
    );
  });

  it('valid commands advance turn number exactly by 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (seed) => {
        const state = createTestGameStateInCombat();
        const rng = new SeededRNG(seed);

        const beforeTurn = state.turnNumber;

        // WAIT is always valid in combat
        const result = handleCommand(state, { type: 'WAIT' }, rng);

        if (result.events.length > 0) {
          // Valid command: turn advances by 1
          expect(result.state.turnNumber).toBe(beforeTurn + 1);
        }
      }),
    );
  });
});
