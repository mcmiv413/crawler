import { describe, it, expect } from 'vitest';
import { createTestGameStateInCombat } from '../test-utils.js';
import { OBJECT_TEMPLATES } from '@dungeon/content';
import { handleDisarmTrap } from '../engine/handlers/disarm-trap.js';
import { handleSetTrap } from '../engine/handlers/set-trap.js';
import { calculateHazardDamage } from './hazard-damage.js';
import { SeededRNG } from '../utils/rng.js';
import { entityId } from '@dungeon/contracts';
import type { ObjectInstance } from '@dungeon/contracts';

describe('Trap System', () => {
  describe('calculateHazardDamage', () => {
    it('calculates trap damage from healthDelta', () => {
      const template = OBJECT_TEMPLATES.get('trap_spikes');
      expect(template).toBeDefined();
      const damage = calculateHazardDamage(template!, 100);
      expect(damage).toEqual(15);
    });

    it('calculates poison trap damage from healthDelta', () => {
      const template = OBJECT_TEMPLATES.get('poison_trap');
      expect(template).toBeDefined();
      const damage = calculateHazardDamage(template!, 100);
      expect(damage).toEqual(20);
    });

    it('calculates lightning trap damage from healthDelta', () => {
      const template = OBJECT_TEMPLATES.get('lightning_trap');
      expect(template).toBeDefined();
      const damage = calculateHazardDamage(template!, 100);
      expect(damage).toEqual(30);
    });

    it('calculates inferno pit damage from healthDelta', () => {
      const template = OBJECT_TEMPLATES.get('inferno_pit');
      expect(template).toBeDefined();
      const damage = calculateHazardDamage(template!, 100);
      expect(damage).toEqual(40);
    });

    it('ensures minimum damage of 1', () => {
      const template = OBJECT_TEMPLATES.get('trap_spikes');
      expect(template).toBeDefined();
      const damage = calculateHazardDamage(template!, 1);
      expect(damage).toBeGreaterThanOrEqual(1);
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

    it('only allows disarming spike and fire traps', () => {
      const rng = new SeededRNG(42);
      let state = createTestGameStateInCombat();

      // Place a poison trap (not disarmable)
      const trapInstance: ObjectInstance = {
        id: entityId('trap1'),
        templateId: 'poison_trap',
        position: { x: 1, y: 0 },
        isExhausted: false,
      };
      const objects = new Map(state.run!.objects);
      objects.set('1,0', trapInstance);
      state = {
        ...state,
        run: { ...state.run!, objects },
      };

      // Try to disarm poison trap
      const result = handleDisarmTrap(state, 'E', rng);

      // Verify trap not removed (poison traps can't be disarmed)
      expect(result.state.run!.objects.has('1,0')).toBe(true);
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
