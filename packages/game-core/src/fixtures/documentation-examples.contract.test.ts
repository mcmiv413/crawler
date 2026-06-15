/**
 * Documentation Examples Validation Test
 *
 * Validates that all JSON examples in docs/guides/adding-fixture.md
 * are valid and align with the actual fixture schema and available content IDs.
 *
 * This test ensures documentation doesn't drift from implementation.
 */

import { describe, it, expect } from 'vitest';
import { validatePlayerFixture, loadPlayerFromFixture } from './player-fixture-loader.js';
import type { PlayerFixture } from './player-fixture-types.js';

// ─── Quick Start Example from docs/guides/adding-fixture.md ──────────────────

const QUICK_START_EXAMPLE: PlayerFixture = {
  schemaVersion: 1,
  level: 5,
  experience: 1000,
  health: 40,
  maxHealth: 50,
  mana: 20,
  maxMana: 30,
  gold: 500,
  equippedWeaponId: 'iron_sword',
  equippedArmorIds: {
    chest: 'leather_vest',
    head: 'leather_cap',
  },
  inventoryItemIds: ['health_potion', 'mana_potion'],
  knownRingSchools: ['fire'],
  ringMastery: {
    fire: { xp: 100 },
  },
  learnedRingSpellIds: ['ember'],
};;

describe('Documentation Examples Validation', () => {
  describe('Quick Start Example (docs/guides/adding-fixture.md)', () => {
    it('should validate the Quick Start example fixture', () => {
      const validation = validatePlayerFixture(QUICK_START_EXAMPLE);
      expect(validation.isValid).toBe(true);
      if (!validation.isValid) {
        console.error('Validation errors:', validation.errors);
      }
    });

    it('should load the Quick Start example without throwing', () => {
      expect(() => {
        loadPlayerFromFixture(QUICK_START_EXAMPLE);
      }).not.toThrow();
    });

    it('should produce a player with correct spell learned', () => {
      const { player } = loadPlayerFromFixture(QUICK_START_EXAMPLE);
      expect(player.learnedRingSpellIds).toContain('ember');
    });

    it('should return { player, itemRegistry } structure', () => {
      const result = loadPlayerFromFixture(QUICK_START_EXAMPLE);
      expect(result).toHaveProperty('player');
      expect(result).toHaveProperty('itemRegistry');
      expect(result.player).toBeDefined();
      expect(result.itemRegistry).toBeDefined();
    });
  });

  describe('equippedWeaponId behavior', () => {
    it('should accept undefined/omitted equippedWeaponId', () => {
      const fixture: PlayerFixture = {
        schemaVersion: 1,
        level: 1,
        // equippedWeaponId intentionally omitted
      };
      const validation = validatePlayerFixture(fixture);
      expect(validation.isValid).toBe(true);
    });

    it('should reject explicit null for equippedWeaponId', () => {
      // This would fail TypeScript compilation, so we test the validator directly
      const fixture = {
        schemaVersion: 1,
        level: 1,
        equippedWeaponId: null,
      } as unknown as PlayerFixture;

      const validation = validatePlayerFixture(fixture);
      // If null is passed, it won't match ITEM_BY_ID and should fail validation
      // (unless we explicitly handle null, which we don't)
      expect(validation.isValid).toBe(false);
    });

    it('should accept a valid weapon ID for equippedWeaponId', () => {
      const fixture: PlayerFixture = {
        schemaVersion: 1,
        level: 1,
        equippedWeaponId: 'iron_sword',
      };
      const validation = validatePlayerFixture(fixture);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Spell ID validation', () => {
    it('should accept "ember" as a valid spell ID', () => {
      const fixture: PlayerFixture = {
        schemaVersion: 1,
        level: 1,
        learnedRingSpellIds: ['ember'],
      };
      const validation = validatePlayerFixture(fixture);
      expect(validation.isValid).toBe(true);
    });

    it('should reject "fireball" (invalid spell ID)', () => {
      const fixture: PlayerFixture = {
        schemaVersion: 1,
        level: 1,
        learnedRingSpellIds: ['fireball'],
      };
      const validation = validatePlayerFixture(fixture);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'learnedRingSpellIds[0]',
          message: expect.stringContaining('fireball'),
        }),
      );
    });

    it('should accept multiple valid spell IDs', () => {
      const fixture: PlayerFixture = {
        schemaVersion: 1,
        level: 1,
        learnedRingSpellIds: ['ember', 'bolt', 'rolling_thunder'],
      };
      const validation = validatePlayerFixture(fixture);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Schema version validation', () => {
    it('should reject invalid schemaVersion', () => {
      const fixture: PlayerFixture = {
        schemaVersion: 999,
        level: 1,
      };
      const validation = validatePlayerFixture(fixture);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'schemaVersion',
        }),
      );
    });

    it('should accept schemaVersion 1', () => {
      const fixture: PlayerFixture = {
        schemaVersion: 1,
        level: 1,
      };
      const validation = validatePlayerFixture(fixture);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Return type structure', () => {
    it('should always return { player, itemRegistry } even for minimal fixtures', () => {
      const fixture: PlayerFixture = {
        schemaVersion: 1,
        level: 1,
      };
      const result = loadPlayerFromFixture(fixture);
      expect(Object.keys(result).sort()).toEqual(['itemRegistry', 'player']);
      expect(result.player).toBeDefined();
      expect(result.itemRegistry).toBeDefined();
    });
  });
});
