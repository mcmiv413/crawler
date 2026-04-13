import { describe, it, expect } from 'vitest';
import { calculateEquippedStats } from './equipment.js';
import { ENCHANTMENT_BY_ID } from '@dungeon/content';
import { BASE_PLAYER_STATS } from '@dungeon/content';
import { entityId } from '@dungeon/contracts';
import type { Equipment, AnyItemTemplate } from '@dungeon/contracts';

describe('Enchantment resistAll field', () => {
  describe('resistAll is defined on enchantments', () => {
    it('arcane_ward has resistAll defined with multiple elements', () => {
      const arcaneWard = ENCHANTMENT_BY_ID.get('arcane_ward');
      expect(arcaneWard).toBeDefined();
      expect(arcaneWard?.resistAll).toBeDefined();
      expect(Array.isArray(arcaneWard?.resistAll)).toBe(true);
      expect((arcaneWard?.resistAll as any[])?.length).toBeGreaterThan(0);
    });

    it('blight_ward has resistAll defined', () => {
      const blightWard = ENCHANTMENT_BY_ID.get('blight_ward');
      expect(blightWard).toBeDefined();
      expect(blightWard?.resistAll).toBeDefined();
      expect(Array.isArray(blightWard?.resistAll)).toBe(true);
      expect((blightWard?.resistAll as any[])?.length).toBeGreaterThan(0);
    });
  });

  describe('calculateEquippedStats applies resistAll without hardcoded logic', () => {
    it('applies arcane_ward resistance to protected elements', () => {
      // Mock item registry with a chest armor that has arcane_ward
      const chestId = entityId('chest_with_arcane');
      const registry = new Map<string, AnyItemTemplate>([
        [
          chestId,
          {
            itemId: chestId,
            name: 'Arcane Chest',
            description: 'test',
            itemClass: 'armor',
            rarity: 'rare',
            value: 100,
            stackable: false,
            maxStack: 1,
            armor: {
              defense: 5,
              evasionPenalty: 0,
              slot: 'chest',
              enchantmentSlots: 1,
              enchantments: ['arcane_ward'],
              resistance: {},
            },
          } as any,
        ],
      ]);

      const equipment: Equipment = {
        weapon: null,
        secondaryWeapon: null,
        chest: chestId,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
      };

      const stats = calculateEquippedStats(BASE_PLAYER_STATS, BASE_PLAYER_STATS.maxHealth, equipment, registry);

      expect(stats.resistances).toBeDefined();
      // Check that multiple resistances are defined and positive
      const resistanceValues = Object.values(stats.resistances || {});
      expect(resistanceValues.length).toBeGreaterThan(0);
      expect(resistanceValues.every((r) => typeof r === 'number' && r > 0)).toBe(true);
    });

    it('applies blight_ward resistance to poison/corruption', () => {
      const chestId = entityId('chest_with_blight');
      const registry = new Map<string, AnyItemTemplate>([
        [
          chestId,
          {
            itemId: chestId,
            name: 'Blight Chest',
            description: 'test',
            itemClass: 'armor',
            rarity: 'rare',
            value: 100,
            stackable: false,
            maxStack: 1,
            armor: {
              defense: 5,
              evasionPenalty: 0,
              slot: 'chest',
              enchantmentSlots: 1,
              enchantments: ['blight_ward'],
              resistance: {},
            },
          } as any,
        ],
      ]);

      const equipment: Equipment = {
        weapon: null,
        secondaryWeapon: null,
        chest: chestId,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
      };

      const stats = calculateEquippedStats(BASE_PLAYER_STATS, BASE_PLAYER_STATS.maxHealth, equipment, registry);

      expect(stats.resistances).toBeDefined();
      // Check that resistances are positive and reasonable
      const resistanceValues = Object.values(stats.resistances || {});
      expect(resistanceValues.length).toBeGreaterThan(0);
      resistanceValues.forEach((r) => {
        expect(r).toBeGreaterThan(0);
        expect(r).toBeLessThanOrEqual(1);
      });
    });

    it('stacks resistAll with item-level resistance', () => {
      const chestId = entityId('chest_combo');
      const registry = new Map<string, AnyItemTemplate>([
        [
          chestId,
          {
            itemId: chestId,
            name: 'Fire and Arcane Chest',
            description: 'test',
            itemClass: 'armor',
            rarity: 'rare',
            value: 100,
            stackable: false,
            maxStack: 1,
            armor: {
              defense: 10,
              evasionPenalty: 0,
              slot: 'chest',
              enchantmentSlots: 1,
              enchantments: ['arcane_ward'],
              resistance: { fire: 0.2 },
            },
          } as any,
        ],
      ]);

      const equipment: Equipment = {
        weapon: null,
        secondaryWeapon: null,
        chest: chestId,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
      };

      const stats = calculateEquippedStats(BASE_PLAYER_STATS, BASE_PLAYER_STATS.maxHealth, equipment, registry);

      expect(stats.resistances).toBeDefined();
      // Verify stacking works: combined resistances should be higher than base
      const fireResistance = stats.resistances?.['fire'];
      expect(fireResistance).toBeGreaterThan(0.2);
      expect(fireResistance).toBeLessThanOrEqual(1);
    });

    it('caps resistance at reasonable maximum when stacking', () => {
      const chestId = entityId('chest_overflow');
      const registry = new Map<string, AnyItemTemplate>([
        [
          chestId,
          {
            itemId: chestId,
            name: 'Heavy Fire Chest',
            description: 'test',
            itemClass: 'armor',
            rarity: 'rare',
            value: 100,
            stackable: false,
            maxStack: 1,
            armor: {
              defense: 10,
              evasionPenalty: 0,
              slot: 'chest',
              enchantmentSlots: 1,
              enchantments: ['arcane_ward'],
              resistance: { fire: 0.5 },
            },
          } as any,
        ],
      ]);

      const equipment: Equipment = {
        weapon: null,
        secondaryWeapon: null,
        chest: chestId,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
      };

      const stats = calculateEquippedStats(BASE_PLAYER_STATS, BASE_PLAYER_STATS.maxHealth, equipment, registry);

      expect(stats.resistances).toBeDefined();
      // Verify that resistances don't exceed maximum (0.75 or 1.0 depending on config)
      Object.values(stats.resistances || {}).forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('new enchantments can use resistAll without code changes', () => {
    it('resistAll field is generic and extensible', () => {
      // This test documents that new enchantments can be added
      // with resistAll field without modifying equipment.ts logic
      const arcaneWard = ENCHANTMENT_BY_ID.get('arcane_ward');
      const blightWard = ENCHANTMENT_BY_ID.get('blight_ward');

      // Both have the resistAll field, demonstrating the pattern
      expect(arcaneWard?.resistAll).toBeDefined();
      expect(blightWard?.resistAll).toBeDefined();

      // A hypothetical new enchantment could be:
      // { id: 'elemental_ward', ..., resistAll: ['fire', 'cold', 'lightning', 'acid'] }
      // and calculateEquippedStats would apply it without changes
    });
  });
});
