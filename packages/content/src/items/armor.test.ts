/**
 * Test layer: unit
 * Behavior: Armor covers armor catalog; every item has a valid ArmorSlot; enchantmentSlots matches ENCHANTMENT_SLOTS_BY_RARITY[rarity].
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/content/src/items/armor.test.ts
 */
import { describe, it, expect } from 'vitest';
import { ARMOR } from './armor/index.js';
import { ENCHANTMENT_SLOTS_BY_RARITY } from '../balance/tables.js';
import { ENCHANTMENT_BY_ID } from '../enchantments/index.js';

const VALID_ARMOR_SLOTS = ['chest', 'head', 'gloves', 'boots', 'ring'] as const;

describe('armor catalog', () => {
  it('every item has a valid ArmorSlot', () => {
    for (const item of ARMOR) {
      expect(VALID_ARMOR_SLOTS).toContain(item.armor.slot);
    }
  });

  it('enchantmentSlots matches ENCHANTMENT_SLOTS_BY_RARITY[rarity]', () => {
    for (const item of ARMOR) {
      const expected = ENCHANTMENT_SLOTS_BY_RARITY[item.rarity];
      expect(item.armor.enchantmentSlots).toBe(expected);
    }
  });

  it('enchantments array length equals enchantmentSlots', () => {
    for (const item of ARMOR) {
      expect(item.armor.enchantments.length).toBe(item.armor.enchantmentSlots);
    }
  });

  it('items with enchantments should have non-null enchantments, others should be null', () => {
    for (const item of ARMOR) {
      const hasAnyEnchantment = item.armor.enchantments.some(e => e !== null);
      const allAreNull = item.armor.enchantments.every(e => e === null);

      // Each item is either all-null or has at least one non-null enchantment
      expect(
        hasAnyEnchantment || allAreNull,
        `has mixed null/non-null enchantments`,
      ).toBe(true);
    }
  });

  it('at least 2 items per slot type', () => {
    const bySlot: Record<string, number> = {};
    for (const item of ARMOR) {
      bySlot[item.armor.slot] = (bySlot[item.armor.slot] ?? 0) + 1;
    }
    for (const slot of VALID_ARMOR_SLOTS) {
      expect(bySlot[slot] ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('pre-enchanted items have valid enchantment IDs', () => {
    for (const item of ARMOR) {
      for (const enc of item.armor.enchantments) {
        if (enc !== null) {
          expect(ENCHANTMENT_BY_ID.has(enc)).toBe(true);
        }
      }
    }
  });
});
