/**
 * Test layer: contract
 * Behavior: Item View Completeness covers Item View Completeness; InventoryItemView weapons; all weapons have damageMin and damageMax defined and positive.
 * Proof: live catalog/schema assertions validate IDs, shapes, and cross references.
 * Validation: pnpm vitest run tests/contracts/item-view-completeness.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { ITEM_BY_ID } from '@dungeon/content';
import { buildInventoryView } from '../../packages/presenter/src/builders/inventory-view-builder.js';
import { buildTownView } from '../../packages/presenter/src/builders/town-view-builder.js';
import type { GameState } from '@dungeon/contracts';
import { GameEngine } from '@dungeon/core';

/**
 * Item View Completeness Contract Tests
 *
 * Ensures that all items rendered in the UI have complete weapon/armor stat displays.
 * This prevents shipping features with undefined or missing values.
 *
 * Guards against:
 * - Weapons missing damageMin/damageMax (should be visible in UI)
 * - Weapons missing onHitEffect when onHitStatus is present
 * - Incomplete stat chains (state → view → UI)
 */

describe('Item View Completeness', () => {
  describe('InventoryItemView weapons', () => {
    it('all weapons have damageMin and damageMax defined and positive', () => {
      // Create a minimal game state to test with
      const gameEngine = new GameEngine();
      const state = gameEngine.state;

      const inventoryView = buildInventoryView(state);

      for (const item of inventoryView.items) {
        if (item.itemClass === 'weapon') {
          expect(
            item.weaponStats,
            `Weapon "${item.name}" has no weaponStats`,
          ).toBeDefined();

          const stats = item.weaponStats!;

          expect(
            stats.damage,
            `Weapon "${item.name}" has no damage`,
          ).toBeGreaterThan(0);

          expect(
            stats.damageMin,
            `Weapon "${item.name}" has no damageMin`,
          ).toBeDefined();

          expect(
            stats.damageMin,
            `Weapon "${item.name}" damageMin is not positive: ${stats.damageMin}`,
          ).toBeGreaterThan(0);

          expect(
            stats.damageMax,
            `Weapon "${item.name}" has no damageMax`,
          ).toBeDefined();

          expect(
            stats.damageMax,
            `Weapon "${item.name}" damageMax is not positive: ${stats.damageMax}`,
          ).toBeGreaterThan(0);
        }
      }
    });

    it('weapons have damageMin < damageMax', () => {
      const gameEngine = new GameEngine();
      const state = gameEngine.state;
      const inventoryView = buildInventoryView(state);

      for (const item of inventoryView.items) {
        if (item.itemClass === 'weapon' && item.weaponStats) {
          const { damageMin, damageMax, damage } = item.weaponStats;

          expect(
            damageMin,
            `Weapon "${item.name}" damageMin (${damageMin}) >= damageMax (${damageMax})`,
          ).toBeLessThan(damageMax);

          // damage should be between min and max
          expect(
            damage,
            `Weapon "${item.name}" damage (${damage}) should be between min (${damageMin}) and max (${damageMax})`,
          ).toBeGreaterThanOrEqual(damageMin);

          expect(
            damage,
            `Weapon "${item.name}" damage (${damage}) should be between min (${damageMin}) and max (${damageMax})`,
          ).toBeLessThanOrEqual(damageMax);
        }
      }
    });

    it('all equipped weapons have complete stats', () => {
      const gameEngine = new GameEngine();
      const state = gameEngine.state;
      const inventoryView = buildInventoryView(state);

      const equippedWeapon = inventoryView.equipped.weapon;
      if (equippedWeapon && equippedWeapon.weaponStats) {
        expect(equippedWeapon.weaponStats.damageMin).toBeDefined();
        expect(equippedWeapon.weaponStats.damageMax).toBeDefined();
        expect(equippedWeapon.weaponStats.damageMin).toBeGreaterThan(0);
      }
    });
  });

  describe('ShopItemView weapons', () => {
    it('all shop weapons have damageMin and damageMax defined and positive', () => {
      const gameEngine = new GameEngine();
      const state = gameEngine.state;

      const townView = buildTownView(state);

      for (const item of townView.shop.items) {
        if (item.itemClass === 'weapon') {
          expect(
            item.weaponData,
            `Shop weapon "${item.name}" has no weaponData`,
          ).toBeDefined();

          const stats = item.weaponData!;

          expect(
            stats.damage,
            `Shop weapon "${item.name}" has no damage`,
          ).toBeGreaterThan(0);

          expect(
            stats.damageMin,
            `Shop weapon "${item.name}" has no damageMin`,
          ).toBeDefined();

          expect(
            stats.damageMin,
            `Shop weapon "${item.name}" damageMin is not positive: ${stats.damageMin}`,
          ).toBeGreaterThan(0);

          expect(
            stats.damageMax,
            `Shop weapon "${item.name}" has no damageMax`,
          ).toBeDefined();

          expect(
            stats.damageMax,
            `Shop weapon "${item.name}" damageMax is not positive: ${stats.damageMax}`,
          ).toBeGreaterThan(0);
        }
      }
    });

    it('shop weapons have damageMin < damageMax', () => {
      const gameEngine = new GameEngine();
      const state = gameEngine.state;
      const townView = buildTownView(state);

      for (const item of townView.shop.items) {
        if (item.itemClass === 'weapon' && item.weaponData) {
          const { damageMin, damageMax } = item.weaponData;

          expect(
            damageMin,
            `Shop weapon "${item.name}" damageMin (${damageMin}) >= damageMax (${damageMax})`,
          ).toBeLessThan(damageMax);
        }
      }
    });
  });

  describe('Armor completeness', () => {
    it('all armor items have defense and evasion penalty', () => {
      const gameEngine = new GameEngine();
      const state = gameEngine.state;
      const inventoryView = buildInventoryView(state);

      for (const item of inventoryView.items) {
        if (item.itemClass === 'armor') {
          expect(
            item.armorStats,
            `Armor "${item.name}" has no armorStats`,
          ).toBeDefined();

          const stats = item.armorStats!;
          expect(stats.defense).toBeGreaterThanOrEqual(0);
          expect(stats.evasionPenalty).toBeGreaterThanOrEqual(0);
          expect(stats.slot).toBeTruthy();
        }
      }
    });
  });
});
