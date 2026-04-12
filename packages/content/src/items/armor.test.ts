import { describe, it, expect } from 'vitest';
import { ARMOR } from './armor.js';
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
      expect(item.armor.enchantmentSlots, `${item.itemId} enchantmentSlots`).toBe(expected);
    }
  });

  it('enchantments array length equals enchantmentSlots', () => {
    for (const item of ARMOR) {
      expect(item.armor.enchantments.length, `${item.itemId} enchantments length`)
        .toBe(item.armor.enchantmentSlots);
    }
  });

  it('null-only enchantments for non-pre-enchanted items', () => {
    const preEnchanted = new Set([
      'regen_vest',
      // D4: New enchanted items
      'spiked_leather', 'ember_cloak', 'shadow_vest', 'bone_guard_plate', 'plague_mantle',
      'warden_helm', 'iron_crown', 'mind_veil',
      'swift_boots', 'phase_steps',
      'grip_gauntlets', 'leech_wraps',
      'venom_ring', 'blessed_ring', 'iron_band', 'ember_ring', 'shadow_ring',
    ]);
    for (const item of ARMOR) {
      if (!preEnchanted.has(item.itemId)) {
        for (const enc of item.armor.enchantments) {
          expect(enc, `${item.itemId} should have null enchantment slots`).toBeNull();
        }
      }
    }
  });

  it('at least 2 items per slot type', () => {
    const bySlot: Record<string, number> = {};
    for (const item of ARMOR) {
      bySlot[item.armor.slot] = (bySlot[item.armor.slot] ?? 0) + 1;
    }
    for (const slot of VALID_ARMOR_SLOTS) {
      expect(bySlot[slot] ?? 0, `slot ${slot} needs at least 2 items`).toBeGreaterThanOrEqual(2);
    }
  });

  it('pre-enchanted items have valid enchantment IDs', () => {
    for (const item of ARMOR) {
      for (const enc of item.armor.enchantments) {
        if (enc !== null) {
          expect(ENCHANTMENT_BY_ID.has(enc), `${enc} not in enchantment catalog`).toBe(true);
        }
      }
    }
  });
});
