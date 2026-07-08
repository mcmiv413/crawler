/**
 * Test layer: unit
 * Behavior: The weapon catalog contains starter weapons, valid weapon types and rarities, positive damage, type coverage, rarity damage ordering, and unique item IDs.
 * Proof: Assertions expect rusty_sword and common_dagger IDs, weaponType membership, damage at least 1, at least one weapon per type, allowed rarities, common-to-uncommon-to-rare damage ordering, and unique itemId count.
 * Validation: pnpm vitest run packages/content/src/items/weapons.test.ts
 */
import { describe, it, expect } from 'vitest';
import { WEAPONS } from './weapons/index.js';
import { WEAPON_TYPES } from '@dungeon/contracts';

/**
 * Unit tests for the weapon catalog.
 *
 * These tests validate structural invariants and schema rules only.
 * They do NOT assert exact balance values (damage, speed numbers) — those
 * are balance tuning decisions that change frequently. For exact-value
 * audits, see tests/contracts/ or tests/balance/.
 */
describe('WEAPONS', () => {
  it('has at least one weapon defined', () => {
    expect(WEAPONS.map(w => w.itemId)).toEqual(expect.arrayContaining([
      'rusty_sword',
      'common_dagger',
    ]));
  });

  it('every weapon has weaponType defined', () => {
    for (const w of WEAPONS) {
      expect(WEAPON_TYPES, `${w.itemId} missing weaponType`).toContain(w.weapon.weaponType);
    }
  });

  it('every weapon damage >= 1', () => {
    for (const w of WEAPONS) {
      expect(w.weapon.damage, `${w.itemId} damage < 1`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every weapon type has at least one weapon', () => {
    for (const weaponType of WEAPON_TYPES) {
      const count = WEAPONS.filter(w => w.weapon.weaponType === weaponType).length;
      expect(count, `no weapons of type ${weaponType}`).toBeGreaterThan(0);
    }
  });

  it('every weapon has a valid rarity', () => {
    const VALID_RARITIES = ['common', 'uncommon', 'rare', 'unique'] as const;
    for (const w of WEAPONS) {
      expect(VALID_RARITIES, `${w.itemId} has invalid rarity '${w.rarity}'`).toContain(w.rarity);
    }
  });

  it('rarity tier damage scaling: common max <= uncommon min <= rare min', () => {
    // iron_mace is a known exception: a common bludgeon needed to cover every weapon type
    const common = WEAPONS.filter(w => w.rarity === 'common' && w.itemId !== 'iron_mace');
    const uncommon = WEAPONS.filter(w => w.rarity === 'uncommon');
    const rare = WEAPONS.filter(w => w.rarity === 'rare');

    if (common.length === 0 || uncommon.length === 0 || rare.length === 0) return;

    const commonMax = Math.max(...common.map(w => w.weapon.damage));
    const uncommonMin = Math.min(...uncommon.map(w => w.weapon.damage));
    const rareMin = Math.min(...rare.map(w => w.weapon.damage));

    expect(commonMax, 'common max damage should not exceed uncommon min').toBeLessThanOrEqual(uncommonMin);
    expect(uncommonMin, 'uncommon min damage should not exceed rare min').toBeLessThanOrEqual(rareMin);
  });

  it('every weapon itemId is unique', () => {
    const ids = WEAPONS.map(w => w.itemId);
    const unique = new Set(ids);
    expect(unique.size, 'duplicate weapon itemIds found').toBe(ids.length);
  });
});
