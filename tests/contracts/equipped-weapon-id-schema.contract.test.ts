/**
 * Test layer: contract
 * Behavior: Player fixtures distinguish null, absent, undefined, and valid string equippedWeaponId values according to loader contract.
 * Proof: Assertions reject null with equippedWeaponId errors mentioning null and undefined, accept absent/undefined with no errors and null equipment weapon, and load iron_sword into a registered itemRegistry EntityId.
 * Validation: pnpm vitest run tests/contracts/equipped-weapon-id-schema.contract.test.ts
 */
/**
 * Contract tests: equippedWeaponId schema — null vs undefined vs absent.
 *
 * These tests pin the accepted type for equippedWeaponId as `string | undefined`.
 * They live in the contract suite because they import the live content registry
 * (ITEM_BY_ID) indirectly through validatePlayerFixture and loadPlayerFromFixture.
 *
 * Resolved type: string | undefined
 *   - undefined (or absent field)  → valid; player has no weapon equipped
 *   - null                         → INVALID; validator must reject with an explicit error
 *   - valid string id              → valid when the id exists in ITEM_BY_ID
 */

import { describe, it, expect } from 'vitest';
import {
  validatePlayerFixture,
  loadPlayerFromFixture,
} from '../../packages/game-core/src/fixtures/player-fixture-loader.js';
import type { PlayerFixture } from '../../packages/game-core/src/fixtures/player-fixture-types.js';

// ─── null handling (must be REJECTED) ────────────────────────────────────────

describe('equippedWeaponId: null is rejected', () => {
  it('rejects null with an error on the equippedWeaponId field', () => {
    // Cast needed: the TypeScript type is string | undefined, but at runtime
    // malformed JSON or incorrect callers may pass null.
    const fixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: null,
    } as unknown as PlayerFixture;

    const result = validatePlayerFixture(fixture);

    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'equippedWeaponId');
    expect(error).toBeDefined();
    expect(error!.message).toMatch(/null/i);
    expect(error!.message).toMatch(/undefined/i); // message must guide the author to the fix
  });

  it('loadPlayerFromFixture throws when equippedWeaponId is null', () => {
    const fixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: null,
    } as unknown as PlayerFixture;

    expect(() => loadPlayerFromFixture(fixture)).toThrow();
  });
});

// ─── undefined / absent field (must be VALID — no weapon equipped) ───────────

describe('equippedWeaponId: undefined means no weapon', () => {
  it('accepts a fixture with equippedWeaponId explicitly set to undefined', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: undefined,
    };

    const result = validatePlayerFixture(fixture);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a fixture with equippedWeaponId field absent (deserialized save)', () => {
    // Simulates loading a save file where the field was never written.
    const rawSave = { schemaVersion: 1, level: 1 };
    const fixture = rawSave as unknown as PlayerFixture;

    const result = validatePlayerFixture(fixture);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('loads a fixture with absent equippedWeaponId → player.equipment.weapon is null', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
    };

    const { player } = loadPlayerFromFixture(fixture);

    expect(player.equipment.weapon).toBeNull();
  });

  it('loads a fixture with explicit equippedWeaponId: undefined → player.equipment.weapon is null', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: undefined,
    };

    const { player } = loadPlayerFromFixture(fixture);

    expect(player.equipment.weapon).toBeNull();
  });
});

// ─── string id (must be VALID when id exists in registry) ────────────────────

describe('equippedWeaponId: valid string id loads correctly', () => {
  it('accepts a known weapon id and sets player.equipment.weapon to an EntityId', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'iron_sword',
    };

    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);

    const { player } = loadPlayerFromFixture(fixture);
    expect(player.equipment.weapon).not.toBeNull();
    expect(typeof player.equipment.weapon).toBe('string');
  });

  it('weapon EntityId is registered in the returned itemRegistry', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'iron_sword',
    };

    const { player, itemRegistry } = loadPlayerFromFixture(fixture);

    expect(player.equipment.weapon).not.toBeNull();
    expect(itemRegistry.items.has(player.equipment.weapon!)).toBe(true);
  });
});

// ─── Type invariant documentation ────────────────────────────────────────────

describe('equippedWeaponId type contract', () => {
  it('PlayerFixture.equippedWeaponId is string | undefined (not string | null)', () => {
    // Compile-time verification: the following assignment must compile without
    // a cast, confirming the type is optional (string | undefined), not nullable.
    const withWeapon: PlayerFixture = { schemaVersion: 1, level: 1, equippedWeaponId: 'iron_sword' };
    const withoutWeapon: PlayerFixture = { schemaVersion: 1, level: 1 };
    const withUndefined: PlayerFixture = { schemaVersion: 1, level: 1, equippedWeaponId: undefined };

    // All three must be accepted by the type system (no cast needed).
    expect(withWeapon.equippedWeaponId).toBe('iron_sword');
    expect(withoutWeapon.equippedWeaponId).toBeUndefined();
    expect(withUndefined.equippedWeaponId).toBeUndefined();
  });
});
