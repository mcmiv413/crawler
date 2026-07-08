/**
 * Test layer: contract
 * Behavior: Player Fixture Validation covers Group 3: Validation failures produce explicit errors (contract suite); rejects unknown item id in inventory; rejects unknown ring spell id.
 * Proof: live catalog/schema assertions validate IDs, shapes, and cross references.
 * Validation: pnpm vitest run tests/contracts/player-fixture-validation.contract.test.ts
 */
/**
 * Contract tests for player fixture validation against live content registries.
 *
 * These tests verify that validatePlayerFixture correctly rejects fixture data
 * that references IDs not present in the live content registries (ITEM_BY_ID,
 * RING_SCHOOL_BY_ID, RING_SPELL_BY_ID).
 *
 * Lives in the contract suite because it depends on the live @dungeon/content
 * registry being populated at test time.
 */

import { describe, it, expect } from 'vitest';
import { validatePlayerFixture, loadPlayerFromFixture } from '../../packages/game-core/src/fixtures/player-fixture-loader.js';
import type { PlayerFixture } from '../../packages/game-core/src/fixtures/player-fixture-types.js';

// ─── Group 3: Validation Failures ────────────────────────────────────────────

describe('Group 3: Validation failures produce explicit errors (contract suite)', () => {
  it('rejects unknown item id in inventory', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      inventoryItemIds: ['nonexistent_item_xyz'],
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    const error = result.errors.find(e => e.field.includes('inventoryItemIds'));
    expect(error).toBeDefined();
    expect(error!.message).toContain('nonexistent_item_xyz');
  });

  it('rejects unknown ring spell id', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      learnedRingSpellIds: ['fake_spell_999'],
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('learnedRingSpellIds'));
    expect(error).toBeDefined();
    expect(error!.message).toContain('fake_spell_999');
  });

  it('rejects unknown ring school id in knownRingSchools', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      knownRingSchools: ['shadow_magic' as never],
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('knownRingSchools'));
    expect(error).toBeDefined();
    expect(error!.message).toContain('shadow_magic');
  });

  it('rejects negative gold', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      gold: -50,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'gold');
    expect(error).toBeDefined();
    expect(error!.message).toContain('gold');
  });

  it('rejects health greater than maxHealth', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      health: 100,
      maxHealth: 50,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'health');
    expect(error).toBeDefined();
    expect(error!.message).toContain('health');
  });

  it('rejects mana greater than maxMana', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      mana: 999,
      maxMana: 20,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'mana');
    expect(error).toBeDefined();
    expect(error!.message).toContain('mana');
  });

  it('rejects negative experience', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      experience: -10,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'experience');
    expect(error).toBeDefined();
    expect(error!.message).toContain('experience');
  });

  it('rejects unsupported schema version', () => {
    const fixture = {
      schemaVersion: 999,
      level: 1,
    } as PlayerFixture;
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'schemaVersion');
    expect(error).toBeDefined();
    expect(error!.message).toContain('999');
  });

  it('rejects level below 1', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 0,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'level');
    expect(error).toBeDefined();
    expect(error!.message).toContain('level');
  });

  it('rejects duplicate items across equipment slots (weapon + ring1)', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'iron_sword',
      activeEquipmentIds: {
        ring1: 'iron_sword',
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e =>
      e.message.toLowerCase().includes('duplicate') || e.field.includes('equip')
    );
    expect(error).toBeDefined();
  });

  it('rejects unknown weapon id in equippedWeaponId', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'legendary_sword_of_doom_that_doesnt_exist',
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'equippedWeaponId');
    expect(error).toBeDefined();
    expect(error!.message).toContain('legendary_sword_of_doom_that_doesnt_exist');
  });

  it('rejects unknown armor id in equippedArmorIds', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedArmorIds: {
        chest: 'mithril_armor_of_the_gods',
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('equippedArmorIds'));
    expect(error).toBeDefined();
    expect(error!.message).toContain('mithril_armor_of_the_gods');
  });

  it('loadPlayerFromFixture throws on invalid fixture', () => {
    const invalidFixture: PlayerFixture = {
      schemaVersion: 1,
      level: 0,
    };
    expect(() => loadPlayerFromFixture(invalidFixture)).toThrow();
  });

  it('each validation error includes the offending field name', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: -5,
      gold: -1,
      experience: -20,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    for (const error of result.errors) {
      expect(typeof error.field).toBe('string');
      expect(error.field.length).toBeGreaterThan(0);
      expect(typeof error.message).toBe('string');
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
