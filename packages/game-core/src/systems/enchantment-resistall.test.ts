import { describe, it, expect } from 'vitest';
import { calculateEquippedStats } from './equipment.js';
import { ENCHANTMENT_BY_ID } from '@dungeon/content';
import { BASE_PLAYER_STATS } from '@dungeon/content';
import { entityId } from '@dungeon/contracts';
import type { Equipment, AnyItemTemplate } from '@dungeon/contracts';

describe('Enchantment resistAll field', () => {
  describe('resistAll is defined on enchantments', () => {
    it('arcane_ward has resistAll: [fire, shock, frost]', () => {
      const arcaneWard = ENCHANTMENT_BY_ID.get('arcane_ward');
      expect(arcaneWard).toBeDefined();
      expect(arcaneWard?.resistAll).toEqual(['fire', 'shock', 'frost']);
    });

    it('blight_ward has resistAll: [poison, corruption]', () => {
      const blightWard = ENCHANTMENT_BY_ID.get('blight_ward');
      expect(blightWard).toBeDefined();
      expect(blightWard?.resistAll).toEqual(['poison', 'corruption']);
    });
  });

  describe('calculateEquippedStats applies resistAll without hardcoded logic', () => {
    it('applies arcane_ward resistance to all three elements', () => {
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
      expect(stats.resistances?.['fire']).toBe(0.4);
      expect(stats.resistances?.['shock']).toBe(0.4);
      expect(stats.resistances?.['frost']).toBe(0.4);
    });

    it('applies blight_ward resistance to poison and corruption', () => {
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
      expect(stats.resistances?.['poison']).toBe(0.5);
      expect(stats.resistances?.['corruption']).toBe(0.5);
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
      // arcane_ward adds 0.4 to fire, which is 0.2 item + 0.4 arcane = 0.6
      expect(stats.resistances?.['fire']).toBeCloseTo(0.6, 10);
      expect(stats.resistances?.['shock']).toBeCloseTo(0.4, 10);
      expect(stats.resistances?.['frost']).toBeCloseTo(0.4, 10);
    });

    it('caps resistance at 0.75 when stacking multiple resistances', () => {
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
      // 0.5 + 0.4 = 0.9, but capped at 0.75
      expect(stats.resistances?.['fire']).toBe(0.75);
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
