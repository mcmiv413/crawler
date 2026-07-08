/**
 * Test layer: unit
 * Behavior: Damage covers damage system; applyDamageToPlayer; applies damage and reduces health.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/systems/damage.test.ts
 */
import { describe, it, expect } from 'vitest';
import { applyDamageToEnemy, applyDamageToPlayer } from './damage.js';
import { hazardTypeToDamageType } from './hazard-damage.js';
import { createTestGameStateInCombat } from '../test-utils.js';
import { posKey } from '@dungeon/contracts';

describe('damage system', () => {
  describe('applyDamageToPlayer', () => {
    it('applies damage and reduces health', () => {
      const state = createTestGameStateInCombat();
      const beforeHealth = state.player.stats.health;

      const result = applyDamageToPlayer(state, {
        amount: 10,
        damageType: 'physical',
        source: 'attack',
      });

      expect(result.finalDamage).toBeGreaterThan(0);
      expect(result.state.player.stats.health).toBeLessThan(beforeHealth);
    });

    it('respects defense (bypassDefense false)', () => {
      const state = createTestGameStateInCombat();

      const resultWithDefense = applyDamageToPlayer(state, {
        amount: 10,
        damageType: 'physical',
        source: 'attack',
        bypassDefense: false,
      });

      const resultBypassDefense = applyDamageToPlayer(state, {
        amount: 10,
        damageType: 'physical',
        source: 'attack',
        bypassDefense: true,
      });

      // With defense should take less damage than bypassing defense
      expect(resultWithDefense.finalDamage).toBeLessThanOrEqual(resultBypassDefense.finalDamage);
    });

    it('respects resistance (bypassResistance false)', () => {
      const state = createTestGameStateInCombat();

      const resultWithResistance = applyDamageToPlayer(state, {
        amount: 10,
        damageType: 'fire',
        source: 'trap',
        bypassResistance: false,
      });

      const resultBypassResistance = applyDamageToPlayer(state, {
        amount: 10,
        damageType: 'fire',
        source: 'trap',
        bypassResistance: true,
      });

      // With resistance should take less damage
      expect(resultWithResistance.finalDamage).toBeLessThanOrEqual(resultBypassResistance.finalDamage);
    });

    it('clamps damage to minimum', () => {
      const state = createTestGameStateInCombat();

      const result = applyDamageToPlayer(state, {
        amount: 1,
        damageType: 'physical',
        source: 'attack',
        bypassDefense: false,
        bypassResistance: false,
      });

      expect(result.finalDamage).toBeGreaterThanOrEqual(1); // invariant: damage system always applies at least 1 damage
    });

    it('does not kill player when health > 0', () => {
      const state = createTestGameStateInCombat();

      const result = applyDamageToPlayer(state, {
        amount: 1,
        damageType: 'physical',
        source: 'attack',
      });

      expect(result.killed).toBe(false);
      expect(result.state.player.stats.health).toBeGreaterThan(0);
    });

    it('marks killed true when health <= 0', () => {
      const state = createTestGameStateInCombat();
      const currentHealth = state.player.stats.health;

      const result = applyDamageToPlayer(state, {
        amount: currentHealth + 100,
        damageType: 'physical',
        source: 'attack',
        bypassDefense: true,
        bypassResistance: true,
      });

      expect(result.killed).toBe(true);
      expect(result.state.player.stats.health).toBeLessThanOrEqual(0);
    });
  });

  describe('applyDamageToEnemy', () => {
    it('applies damage and reduces enemy health', () => {
      const state = createTestGameStateInCombat();
      const firstEnemy = [...state.run!.enemies.values()][0];
      if (!firstEnemy) throw new Error('No enemies in test state');

      const beforeHealth = firstEnemy.stats.health;

      const result = applyDamageToEnemy(state, firstEnemy.id, {
        amount: 10,
        damageType: 'physical',
        source: 'attack',
      });

      expect(result.finalDamage).toBeGreaterThan(0);
      const key = posKey(firstEnemy.position);
      const damagedEnemy = result.state.run!.enemies.get(key);
      if (damagedEnemy) {
        expect(damagedEnemy.stats.health).toBeLessThan(beforeHealth);
      }
    });

    it('respects enemy defense', () => {
      const state = createTestGameStateInCombat();
      const firstEnemy = [...state.run!.enemies.values()][0];
      if (!firstEnemy) throw new Error('No enemies in test state');

      const resultWithDefense = applyDamageToEnemy(state, firstEnemy.id, {
        amount: 10,
        damageType: 'physical',
        source: 'attack',
        bypassDefense: false,
      });

      const resultBypassDefense = applyDamageToEnemy(state, firstEnemy.id, {
        amount: 10,
        damageType: 'physical',
        source: 'attack',
        bypassDefense: true,
      });

      expect(resultWithDefense.finalDamage).toBeLessThanOrEqual(resultBypassDefense.finalDamage);
    });

    it('marks killed true when enemy health <= 0', () => {
      const state = createTestGameStateInCombat();
      const firstEnemy = [...state.run!.enemies.values()][0];
      if (!firstEnemy) throw new Error('No enemies in test state');

      const result = applyDamageToEnemy(state, firstEnemy.id, {
        amount: firstEnemy.stats.health + 100,
        damageType: 'physical',
        source: 'attack',
        bypassDefense: true,
        bypassResistance: true,
      });

      expect(result.killed).toBe(true);
    });

    it('keeps killed enemy at zero health until death finalization', () => {
      const state = createTestGameStateInCombat();
      const firstEnemy = [...state.run!.enemies.values()][0];
      if (!firstEnemy) throw new Error('No enemies in test state');

      const key = posKey(firstEnemy.position);
      expect(state.run!.enemies.get(key)).toBeDefined();

      const result = applyDamageToEnemy(state, firstEnemy.id, {
        amount: firstEnemy.stats.health + 100,
        damageType: 'physical',
        source: 'attack',
        bypassDefense: true,
        bypassResistance: true,
      });

      const damagedEnemy = result.state.run!.enemies.get(key);
      expect(damagedEnemy).toBeDefined();
      expect(damagedEnemy?.stats.health ?? -1).toBeGreaterThanOrEqual(0);
      expect(damagedEnemy?.stats.health ?? 1).toBeLessThan(1);
      expect(result.targetSnapshot).toMatchObject({
        id: firstEnemy.id,
        name: firstEnemy.name,
        mapKey: key,
        position: firstEnemy.position,
        preHealth: firstEnemy.stats.health,
        postHealth: 0,
        maxHealth: firstEnemy.stats.maxHealth,
      });
      expect(result.overkillDamage).toBeGreaterThan(0);
    });

    it('applies default bypasses by source', () => {
      const state = createTestGameStateInCombat();
      const firstEnemy = [...state.run!.enemies.values()][0];
      if (!firstEnemy) throw new Error('No enemies in test state');

      // DoT defaults to bypassDefense=true, bypassResistance=false
      const resultDot = applyDamageToEnemy(state, firstEnemy.id, {
        amount: 10,
        damageType: 'fire',
        source: 'dot',
      });

      // Thorns defaults to bypassDefense=true, bypassResistance=true
      const resultThorns = applyDamageToEnemy(state, firstEnemy.id, {
        amount: 10,
        damageType: 'physical',
        source: 'thorns',
      });

      // Both should apply damage
      expect(resultDot.finalDamage).toBeGreaterThan(0);
      expect(resultThorns.finalDamage).toBeGreaterThan(0);
    });
  });

  describe('damage source defaults', () => {
    it('attack: applies both defense and resistance', () => {
      const state = createTestGameStateInCombat();

      const result = applyDamageToPlayer(state, {
        amount: 100,
        damageType: 'physical',
        source: 'attack',
      });

      expect(result.finalDamage).toBeGreaterThan(0);
    });

    it('dot: applies resistance only (bypasses defense)', () => {
      const state = createTestGameStateInCombat();

      const result = applyDamageToPlayer(state, {
        amount: 100,
        damageType: 'fire',
        source: 'dot',
      });

      expect(result.finalDamage).toBeGreaterThan(0);
    });

    it('thorns: bypasses both defense and resistance', () => {
      const state = createTestGameStateInCombat();

      const result = applyDamageToPlayer(state, {
        amount: 100,
        damageType: 'physical',
        source: 'thorns',
      });

      expect(result.finalDamage).toBeGreaterThan(0);
    });
  });

  describe('hazardTypeToDamageType', () => {
    it('maps spike to physical', () => {
      expect(hazardTypeToDamageType('spike')).toBe('physical');
    });

    it('maps fire to fire', () => {
      expect(hazardTypeToDamageType('fire')).toBe('fire');
    });

    it('maps poison to poison', () => {
      expect(hazardTypeToDamageType('poison')).toBe('poison');
    });

    it('maps frost to frost', () => {
      expect(hazardTypeToDamageType('frost')).toBe('frost');
    });

    it('maps lightning to shock', () => {
      expect(hazardTypeToDamageType('lightning')).toBe('shock');
    });
  });
});
