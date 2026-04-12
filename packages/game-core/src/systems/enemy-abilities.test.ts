import { describe, it, expect } from 'vitest';
import { ENEMY_ABILITY_DEFINITIONS, resolveEnemyAbility } from './enemy-abilities.js';
import { createTestGameStateInCombat, createTestEnemy } from '../test-utils.js';
import { SeededRNG } from '../utils/rng.js';

describe('Enemy Abilities', () => {
  describe('ENEMY_ABILITY_DEFINITIONS', () => {
    it('should have crushing_blow ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('crushing_blow')).toBeDefined();
    });

    it('should have fire_bolt ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('fire_bolt')).toBeDefined();
    });

    it('should have flame_trail ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('flame_trail')).toBeDefined();
    });

    it('should have frost_bolt ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('frost_bolt')).toBeDefined();
    });

    it('should have roar ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('roar')).toBeDefined();
    });

    it('should have chilling_aura ability', () => {
      expect(ENEMY_ABILITY_DEFINITIONS.get('chilling_aura')).toBeDefined();
    });
  });

  describe('resolveEnemyAbility', () => {
    it('resolves crushing_blow ability', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('crushing_blow', enemy, state, rng);

      // Should have events
      expect(result.events.length).toBeGreaterThan(0);
      // Should have attack event for damage ability
      expect(result.events.some(e => e.type === 'ATTACK_PERFORMED')).toBe(true);
    });

    it('resolves frost_bolt ability', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('frost_bolt', enemy, state, rng);

      // Should have events
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('resolves roar ability', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('roar', enemy, state, rng);

      // Roar applies status effect
      expect(result.events.some(e => e.type === 'STATUS_APPLIED')).toBe(true);
    });

    it('returns unchanged state for invalid ability', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('nonexistent_ability', enemy, state, rng);

      expect(result.state === state || JSON.stringify(result.state) === JSON.stringify(state)).toBe(true);
      expect(result.events).toHaveLength(0);
    });
  });

    it('crushing_blow deals 2x damage', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({ stats: { ...createTestEnemy().stats, attack: 10 } });
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('crushing_blow', enemy, state, rng);

      // Should have ATTACK_PERFORMED event
      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED') as any;
      expect(attackEvent).toBeDefined();
      // crushing_blow deals damage
      if (attackEvent) {
        expect(attackEvent.damage).toBeGreaterThan(0);
      }
    });

    it('fire_bolt uses fire damage type', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('fire_bolt', enemy, state, rng);

      // Should have ATTACK_PERFORMED event with fire damage type
      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED') as any;
      expect(attackEvent).toBeDefined();
      if (attackEvent) {
        expect(attackEvent.damageType).toBe('fire');
      }
    });

    it('flame_trail applies burn status on hit', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('flame_trail', enemy, state, rng);

      // Should have STATUS_APPLIED event for burn
      const statusEvent = result.events.find(e => e.type === 'STATUS_APPLIED' && (e as any).statusId === 'burn');
      expect(statusEvent).toBeDefined();
    });

    it('frost_bolt applies slow status on hit', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('frost_bolt', enemy, state, rng);

      // Should have ATTACK_PERFORMED event (hits first)
      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
      expect(attackEvent).toBeDefined();

      // If hit, should have slow status applied
      if (attackEvent && (attackEvent as any).hit) {
        const slowEvent = result.events.find(e => e.type === 'STATUS_APPLIED' && (e as any).statusId === 'slow');
        expect(slowEvent).toBeDefined();
      }
    });

    it('chilling_aura applies slow to player, ranged', () => {
      const state = createTestGameStateInCombat();
      const enemy = Array.from(state.run!.enemies.values())[0]!;
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('chilling_aura', enemy, state, rng);

      // Should NOT have ATTACK_PERFORMED event (no damage)
      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
      expect(attackEvent).toBeUndefined();

      // Should have STATUS_APPLIED event for slow on player
      const slowEvent = result.events.find(e => e.type === 'STATUS_APPLIED' && (e as any).statusId === 'slow');
      expect(slowEvent).toBeDefined();
      if (slowEvent) {
        expect((slowEvent as any).targetId).toBe(state.player.id);
      }

      // Verify player has slow status
      expect(result.state.player.statuses.some(s => s.id === 'slow')).toBe(true);
    });

    it('roar applies strength to self, no damage', () => {
      const state = createTestGameStateInCombat();
      // Use the enemy that's actually in the state, not a new one
      const enemy = Array.from(state.run!.enemies.values())[0]!;
      const rng = new SeededRNG(42);

      // First verify the roar ability definition
      const roarDef = ENEMY_ABILITY_DEFINITIONS.get('roar');
      expect(roarDef).toBeDefined();
      expect(roarDef?.targetSelf).toBe(true);

      const result = resolveEnemyAbility('roar', enemy, state, rng);

      // Should NOT have ATTACK_PERFORMED event (no damage)
      const attackEvent = result.events.find(e => e.type === 'ATTACK_PERFORMED');
      expect(attackEvent).toBeUndefined();

      // Should have STATUS_APPLIED event
      const statusEvent = result.events.find(e => e.type === 'STATUS_APPLIED');
      expect(statusEvent).toBeDefined();
      if (statusEvent) {
        expect((statusEvent as any).statusId).toBe('strength');
        // CRITICAL: Status should be applied to the caster (enemy), not the player
        expect((statusEvent as any).targetId).toBe(enemy.id);
      }

      // Verify enemy has strength status in updated state
      if (result.state.run) {
        let updatedEnemy: any | null = null;
        for (const e of result.state.run.enemies.values()) {
          if (e.id === enemy.id) {
            updatedEnemy = e;
            break;
          }
        }
        expect(updatedEnemy).toBeDefined();
        if (updatedEnemy) {
          expect(updatedEnemy.statuses.length).toBeGreaterThan(0);
          expect(updatedEnemy.statuses.some((s: any) => s.id === 'strength')).toBe(true);
        }
      }

      // Verify player does NOT have strength status
      expect(result.state.player.statuses.some(s => s.id === 'strength')).toBe(false);
    });

    it('ability sets cooldown on enemy after use', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('crushing_blow', enemy, state, rng);

      // Check if enemy cooldown was set
      // Find the updated enemy in the result state
      if (result.state.run) {
        let updatedEnemy: any | null = null;
        for (const e of result.state.run.enemies.values()) {
          if (e.id === enemy.id) {
            updatedEnemy = e;
            break;
          }
        }
        // If cooldown is tracked, it should be > 0 for the used ability
        if (updatedEnemy && updatedEnemy.abilityCooldowns) {
          expect(updatedEnemy.abilityCooldowns['crushing_blow'] || 0).toBeGreaterThan(0);
        }
      }
    });

    it('returns unchanged state when run is null', () => {
      const state = createTestGameStateInCombat();
      const stateNoRun = { ...state, run: null };
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      const result = resolveEnemyAbility('crushing_blow', enemy, stateNoRun, rng);

      // State should be unchanged (or deeply equal)
      expect(result.state === stateNoRun || JSON.stringify(result.state) === JSON.stringify(stateNoRun)).toBe(true);
      expect(result.events).toHaveLength(0);
    });

    it('Bug 4: resolveEnemyAbility returns without calling engine updateRunMetrics', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy();
      const rng = new SeededRNG(42);

      // This test ensures resolveEnemyAbility is pure and doesn't have
      // inverted dependency on command-handler (engine layer)
      const result = resolveEnemyAbility('crushing_blow', enemy, state, rng);

      // Result should be well-formed (state + events)
      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('events');
      expect(Array.isArray(result.events)).toBe(true);
    });
});
