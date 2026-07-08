/**
 * Test layer: unit
 * Behavior: Trap System covers Trap System; calculateHazardDamage; uses absolute healthDelta when rarity is absent.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/systems/trap-system.test.ts
 */
import { describe, it, expect } from 'vitest';
import { createTestGameStateInCombat } from '../test-utils.js';
import { handleDisarmTrap } from '../engine/handlers/disarm-trap.js';
import { handleSetTrap } from '../engine/handlers/set-trap.js';
import { calculateHazardDamage } from './hazard-damage.js';
import { SeededRNG } from '../utils/rng.js';
import { entityId } from '@dungeon/contracts';
import type { ObjectInstance, ObjectTemplate } from '@dungeon/contracts';

describe('Trap System', () => {
  describe('calculateHazardDamage', () => {
    function createHazardTemplate(
      overrides: Partial<ObjectTemplate> = {},
    ): ObjectTemplate {
      return {
        templateId: 'test_trap',
        name: 'Test Trap',
        description: 'Generated hazard for unit tests.',
        ascii: '^',
        color: '#fff',
        spriteName: 'spikes',
        healthDelta: -7,
        consumable: false,
        blocksMovement: false,
        isHazard: true,
        objectCategory: 'trap',
        hazardType: 'spike',
        ...overrides,
      };
    }

    it('uses absolute healthDelta when rarity is absent', () => {
      const trap = createHazardTemplate({ healthDelta: -7 });
      const damage = calculateHazardDamage(trap, 100);

      expect(damage).toBe(Math.abs(trap.healthDelta));
    });

    it('increases damage as hazard rarity increases', () => {
      const maxHealth = 100;

      const commonDamage = calculateHazardDamage(createHazardTemplate({ rarity: 'common' }), maxHealth);
      const uncommonDamage = calculateHazardDamage(createHazardTemplate({ rarity: 'uncommon' }), maxHealth);
      const rareDamage = calculateHazardDamage(createHazardTemplate({ rarity: 'rare' }), maxHealth);
      const epicDamage = calculateHazardDamage(createHazardTemplate({ rarity: 'epic' }), maxHealth);
      const legendaryDamage = calculateHazardDamage(createHazardTemplate({ rarity: 'legendary' }), maxHealth);

      expect(commonDamage).toBeLessThan(uncommonDamage);
      expect(uncommonDamage).toBeLessThan(rareDamage);
      expect(rareDamage).toBeLessThan(epicDamage);
      expect(epicDamage).toBeLessThan(legendaryDamage);
    });

    it('ensures minimum damage of 1', () => {
      const damage = calculateHazardDamage(createHazardTemplate({ rarity: 'common' }), 1);

      expect(damage).toBeGreaterThanOrEqual(1);
      expect(damage).toBeLessThan(2);
    });
  });

  describe('handleDisarmTrap', () => {
    it('disarms adjacent trap and adds to inventory', () => {
      const rng = new SeededRNG(42);
      let state = createTestGameStateInCombat();

      // Place a trap at (1, 0) - east of player
      const trapInstance: ObjectInstance = {
        id: entityId('trap1'),
        templateId: 'trap_spikes',
        position: { x: 1, y: 0 },
        isExhausted: false,
      };
      const objects = new Map(state.run!.objects);
      objects.set('1,0', trapInstance);
      state = {
        ...state,
        run: { ...state.run!, objects },
      };

      // Disarm the trap (direction East)
      const result = handleDisarmTrap(state, 'E', rng);

      // Verify trap removed from floor
      expect(result.state.run!.objects.has('1,0')).toBe(false);

      // Verify trap item added to inventory
      expect(result.state.player.inventory.length).toBeGreaterThan(state.player.inventory.length);
    });

    it('rejects disarm if trap is not adjacent', () => {
      const rng = new SeededRNG(42);
      let state = createTestGameStateInCombat();

      // Place a trap far away (5, 5)
      const trapInstance: ObjectInstance = {
        id: entityId('trap1'),
        templateId: 'trap_spikes',
        position: { x: 5, y: 5 },
        isExhausted: false,
      };
      const objects = new Map(state.run!.objects);
      objects.set('5,5', trapInstance);
      state = {
        ...state,
        run: { ...state.run!, objects },
      };

      // Try to disarm (direction East)
      const result = handleDisarmTrap(state, 'E', rng);

      // Verify trap not removed
      expect(result.state.run!.objects.has('5,5')).toBe(true);
    });

    it('rejects disarm if no trap at target', () => {
      const rng = new SeededRNG(42);
      const state = createTestGameStateInCombat();

      // Try to disarm empty tile
      const result = handleDisarmTrap(state, 'E', rng);

      // Verify state unchanged
      expect(result.state).toEqual(state);
    });

    it('allows disarming all trap types (spike, fire, poison, frost, lightning)', () => {
      const trapTypes = ['trap_spikes', 'fire_pit', 'poison_trap', 'frost_trap', 'lightning_trap'];

      for (const templateId of trapTypes) {
        const rng = new SeededRNG(42);
        let state = createTestGameStateInCombat();

        // Place a trap
        const trapInstance: ObjectInstance = {
          id: entityId(`trap_${templateId}`),
          templateId,
          position: { x: 1, y: 0 },
          isExhausted: false,
        };
        const objects = new Map(state.run!.objects);
        objects.set('1,0', trapInstance);
        state = {
          ...state,
          run: { ...state.run!, objects },
        };

        // Try to disarm trap
        const result = handleDisarmTrap(state, 'E', rng);

        // Verify trap was removed and added to inventory
        expect(result.state.run!.objects.has('1,0')).toBe(false);
        expect(result.state.player.inventory.length).toBeGreaterThan(state.player.inventory.length);
      }
    });
  });

  describe('handleSetTrap', () => {
    it('rejects placement if inventory item not found', () => {
      const rng = new SeededRNG(42);
      const state = createTestGameStateInCombat();
      const result = handleSetTrap(state, 'E', entityId('nonexistent'), rng);
      expect(result.state).toEqual(state);
    });

    it('rejects placement in invalid phase', () => {
      const rng = new SeededRNG(42);
      let state = createTestGameStateInCombat();
      state = { ...state, phase: 'town' as const };
      const result = handleSetTrap(state, 'E', entityId('test_trap'), rng);
      expect(result.state).toEqual(state);
    });
  });
});
