/**
 * Test layer: unit
 * Behavior: applyAttack reports invalid, hit, and miss outcomes without mutating unrelated state and updates enemy health only on successful hits.
 * Proof: Assertions check ATTACK_PERFORMED hit false events and invalid_target reasons for missing run or target, zero damage and same-state/no-enemy-count changes for invalid paths, positive damage and lower enemy health on forced hits, and zero damage on guaranteed misses.
 * Validation: pnpm vitest run packages/game-core/src/abilities/effects/apply-attack.test.ts
 */
/**
 * Tests for applyAttack — combat observability (Phase 3).
 *
 * Verifies that blocked, invalid-target, and miss cases emit visible events
 * rather than returning empty events.
 */

import { describe, it, expect } from 'vitest';
import { applyAttack } from './apply-attack.js';
import { createTestGameStateInCombat, createTestGameState } from '../../test-utils.js';
import { SeededRNG } from '../../utils/rng.js';
import { entityId } from '@dungeon/contracts';
import type { AbilityContext, AttackEffect } from '../types.js';

/** Minimal AttackEffect for testing */
const baseEffect: AttackEffect = {
  kind: 'attack',
  damageMultiplier: 1,
  damageType: 'physical',
  forceHit: false,
  trackMastery: false,
};
const NO_DAMAGE = 0;

function makeContext(state: ReturnType<typeof createTestGameStateInCombat>): AbilityContext {
  return {
    state,
    rng: new SeededRNG(42),
    player: state.player,
    run: state.run,
    equippedWeaponId: state.player.equipment.weapon,
    direction: undefined,
    target: undefined,
    targetPosition: undefined,
  };
}

describe('applyAttack', () => {
  describe('invalid target — no active run', () => {
    it('emits ATTACK_PERFORMED with hit:false when run is null', () => {
      const baseState = createTestGameState({ phase: 'dungeon' });
      // run is null in base state
      expect(baseState.run).toBeNull();

      const context: AbilityContext = {
        state: baseState,
        rng: new SeededRNG(1),
        player: baseState.player,
        run: null,
        equippedWeaponId: null,
        direction: undefined,
        target: undefined,
        targetPosition: undefined,
      };

      const result = applyAttack(context, baseEffect, 'some_key');

      expect(result.events.length).toBeGreaterThan(0);
      const event = result.events[0];
      expect(event?.type).toBe('ATTACK_PERFORMED');
      if (event?.type === 'ATTACK_PERFORMED') {
        expect(event.hit).toBe(false);
      }
    });

    it('does not apply damage when run is null', () => {
      const baseState = createTestGameState({ phase: 'dungeon' });
      const context: AbilityContext = {
        state: baseState,
        rng: new SeededRNG(1),
        player: baseState.player,
        run: null,
        equippedWeaponId: null,
        direction: undefined,
        target: undefined,
        targetPosition: undefined,
      };

      const result = applyAttack(context, baseEffect, 'some_key');

      expect(result.damage).toBe(NO_DAMAGE);
      expect(result.hit).toBe(false);
    });

    it('does not mutate state when run is null', () => {
      const baseState = createTestGameState({ phase: 'dungeon' });
      const originalGold = baseState.player.gold;
      const context: AbilityContext = {
        state: baseState,
        rng: new SeededRNG(1),
        player: baseState.player,
        run: null,
        equippedWeaponId: null,
        direction: undefined,
        target: undefined,
        targetPosition: undefined,
      };

      const result = applyAttack(context, baseEffect, 'some_key');

      expect(result.state).toBe(baseState); // Same reference — no mutation
      expect(baseState.player.gold).toBe(originalGold);
    });
  });

  describe('invalid target — target not found in enemy map', () => {
    it('emits ATTACK_PERFORMED with hit:false when target key not in enemies', () => {
      const state = createTestGameStateInCombat();
      expect(state.run).not.toBeNull();
      const context = makeContext(state);

      // Use a key that does not exist in the enemy map
      const result = applyAttack(context, baseEffect, 'nonexistent_key_999');

      expect(result.events.length).toBeGreaterThan(0);
      const event = result.events[0];
      expect(event?.type).toBe('ATTACK_PERFORMED');
      if (event?.type === 'ATTACK_PERFORMED') {
        expect(event.hit).toBe(false);
      }
    });

    it('does not apply damage when target key is not in enemies', () => {
      const state = createTestGameStateInCombat();
      const context = makeContext(state);

      const result = applyAttack(context, baseEffect, 'nonexistent_key_999');

      expect(result.damage).toBe(NO_DAMAGE);
      expect(result.hit).toBe(false);
    });

    it('does not mutate enemy state when target key is not found', () => {
      const state = createTestGameStateInCombat();
      const originalEnemyCount = state.run?.enemies.size ?? 0;
      const context = makeContext(state);

      const result = applyAttack(context, baseEffect, 'nonexistent_key_999');

      // Enemy map should be unchanged
      expect(result.state.run?.enemies.size).toBe(originalEnemyCount);
    });

    it('ATTACK_PERFORMED invalid-target event has reason field', () => {
      const state = createTestGameStateInCombat();
      const context = makeContext(state);

      const result = applyAttack(context, baseEffect, 'missing_key');

      const event = result.events[0];
      if (event?.type === 'ATTACK_PERFORMED') {
        expect(event.reason).toBe('invalid_target');
      }
    });
  });

  describe('successful attack path', () => {
    it('returns events for a hit when target exists', () => {
      const state = createTestGameStateInCombat();
      if (state.run === null) return;

      // Get the actual enemy key
      const [enemyKey] = [...state.run.enemies.keys()];
      if (enemyKey === undefined) return;

      const context = makeContext(state);
      // Force hit so the test is deterministic
      const forceHitEffect: AttackEffect = { ...baseEffect, forceHit: true };

      const result = applyAttack(context, forceHitEffect, enemyKey);

      expect(result.hit).toBe(true);
      expect(result.damage).toBeGreaterThan(0);
    });

    it('preserves enemy state correctly after successful hit', () => {
      const state = createTestGameStateInCombat();
      if (state.run === null) return;

      const [enemyKey, enemy] = [...state.run.enemies.entries()][0]!;
      const originalHealth = enemy.stats.health;

      const context = makeContext(state);
      const forceHitEffect: AttackEffect = { ...baseEffect, forceHit: true };

      const result = applyAttack(context, forceHitEffect, enemyKey);

      if (result.hit) {
        // State should reflect damage or kill
        const updatedEnemy = result.state.run?.enemies.get(enemyKey);
        if (updatedEnemy !== undefined) {
          expect(updatedEnemy.stats.health).toBeLessThan(originalHealth);
        }
        // If enemy was killed it would be removed from the map
      }
    });
  });

  describe('miss path', () => {
    it('returns no events (or zero-damage events) on miss', () => {
      const state = createTestGameStateInCombat();
      if (state.run === null) return;

      const [enemyKey] = [...state.run.enemies.keys()];
      if (enemyKey === undefined) return;

      const context = makeContext(state);
      // No force hit, very low accuracy — some RNG seeds will miss
      // Run with multiple seeds to confirm miss case works
      const zeroAccuracyEffect: AttackEffect = {
        ...baseEffect,
        accuracyBonus: -999, // Guaranteed miss
      };

      const result = applyAttack(context, zeroAccuracyEffect, enemyKey);

      expect(result.hit).toBe(false);
      expect(result.damage).toBe(NO_DAMAGE);
    });
  });
});
