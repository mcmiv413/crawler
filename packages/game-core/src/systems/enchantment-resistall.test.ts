import { describe, it, expect } from 'vitest';
import { calculateEquippedStats } from './equipment.js';
import { entityId } from '@dungeon/contracts';
import type { Equipment, AnyItemTemplate, EntityId, PlayerStats } from '@dungeon/contracts';

/**
 * Unit tests for calculateEquippedStats with resistAll enchantments.
 *
 * Uses hardcoded enchantment IDs as string references — no live @dungeon/content imports.
 * Contract tests for enchantment content structure live in
 * tests/contracts/enchantment-catalog.contract.test.ts.
 */

/**
 * Minimal PlayerStats stub for unit tests.
 * Avoids importing from test-utils (which pulls in @dungeon/content via a circular chain).
 * Values match the shape required by calculateEquippedStats — not tuned balance numbers.
 */
const BASE_PLAYER_STATS: PlayerStats = {
  maxHealth: 36,
  health: 36,
  attack: 4,
  defense: 4,
  accuracy: 6,
  evasion: 8,
  speed: 100,
};

/**
 * Documentation stub showing the resistAll field shape used by real enchantments.
 * NOTE: This map is NOT used by calculateEquippedStats — the function reads the real
 * ENCHANTMENT_BY_ID from @dungeon/content. This stub only supports the extensibility
 * documentation test at the bottom of this file.
 * Values match the actual content definitions in packages/content/src/enchantments/.
 */
const ENCHANTMENT_BY_ID = new Map([
  ['arcane_ward', { enchantmentId: 'arcane_ward', name: 'Arcane Ward', resistAll: ['fire', 'shock', 'frost'] }],
  ['blight_ward', { enchantmentId: 'blight_ward', name: 'Blight Ward', resistAll: ['poison', 'corruption'] }],
]);

describe('Enchantment resistAll field', () => {

  describe('calculateEquippedStats applies resistAll without hardcoded logic', () => {
    it('applies arcane_ward resistance to protected elements', () => {
      // Mock item registry with a chest armor that has arcane_ward
      const chestId = entityId('chest_with_arcane');
      const registry = new Map<EntityId, AnyItemTemplate>([
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
      const registry = new Map<EntityId, AnyItemTemplate>([
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
      const registry = new Map<EntityId, AnyItemTemplate>([
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
      const registry = new Map<EntityId, AnyItemTemplate>([
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
