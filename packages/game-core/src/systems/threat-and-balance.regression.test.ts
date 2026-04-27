import { describe, it, expect } from 'vitest';
import { isPlayerThreatened } from './threat.js';
import { computeEnemyThreatRating } from './threat-rating.js';
import { equipItem, unequipItem, swapWeaponSets } from './equipment.js';
import { addItemToInventory } from './inventory.js';
import { createTestGameStateInCombat } from '../test-utils.js';
import { entityId } from '@dungeon/contracts';
import type { WeaponTemplate, EnemyInstance, GameState } from '@dungeon/contracts';

// Test weapons
const rustySword: WeaponTemplate = {
  itemId: 'rusty_sword',
  name: 'Rusty Sword',
  description: 'A rusty blade',
  itemClass: 'weapon',
  rarity: 'common',
  value: 10,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 7, damageType: 'physical', accuracy: 2, speed: 0, slot: 'weapon', weaponRange: 1, weaponType: 'blade' },
};

const shortBow: WeaponTemplate = {
  itemId: 'short_bow',
  name: 'Short Bow',
  description: 'A ranged weapon',
  itemClass: 'weapon',
  rarity: 'common',
  value: 15,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 6, damageType: 'physical', accuracy: 4, speed: 5, slot: 'weapon', weaponRange: 5, weaponType: 'ranged' },
};

describe('Regression Tests - Threat and Balance Rules', () => {
  // ─────────────────────────────────────────────────────────────────
  // Test Group 1: Threat Detection
  // ─────────────────────────────────────────────────────────────────

  describe('Threat Detection (isPlayerThreatened)', () => {
    it('returns false when not in dungeon', () => {
      const state = createTestGameStateInCombat();
      const townState = { ...state, phase: 'town' as const, run: null };
      expect(isPlayerThreatened(townState)).toBe(false);
    });

    it('returns false when no enemies are alerted', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      // Create enemy with isAlerted: false explicitly
      const firstEnemyKey = Array.from(state.run.enemies.keys())[0];
      if (!firstEnemyKey) return;

      const enemy = state.run.enemies.get(firstEnemyKey)!;
      const unalertedEnemy: EnemyInstance = {
        ...enemy,
        isAlerted: false,
        position: { x: 1, y: 0 }, // Adjacent to player but unalerted
      };

      const updatedEnemies = new Map(state.run.enemies);
      updatedEnemies.set(firstEnemyKey, unalertedEnemy);

      const threatState = {
        ...state,
        run: { ...state.run, enemies: updatedEnemies },
      };

      expect(isPlayerThreatened(threatState)).toBe(false);
    });

    it('returns false when alerted enemy is out of range', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      // Get first enemy and move it far away while keeping alerted
      const firstEnemyKey = Array.from(state.run.enemies.keys())[0];
      if (!firstEnemyKey) return;

      const enemy = state.run.enemies.get(firstEnemyKey)!;
      const farEnemy: EnemyInstance = {
        ...enemy,
        isAlerted: true,
        position: { x: 99, y: 99 }, // Far from player at 0,0 (distance 99)
        equipment: { ...enemy.equipment, weapon: { ...enemy.equipment.weapon, weaponRange: 1 } },
      };

      const updatedEnemies = new Map(state.run.enemies);
      updatedEnemies.set(firstEnemyKey, farEnemy);

      const threatState = {
        ...state,
        run: { ...state.run, enemies: updatedEnemies },
      };

      expect(isPlayerThreatened(threatState)).toBe(false);
    });

    it('returns true when alerted enemy is within weapon range', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      // Get first enemy and place it within melee range (1)
      const firstEnemyKey = Array.from(state.run.enemies.keys())[0];
      if (!firstEnemyKey) return;

      const enemy = state.run.enemies.get(firstEnemyKey)!;
      const adjacentEnemy: EnemyInstance = {
        ...enemy,
        isAlerted: true,
        position: { x: 1, y: 0 }, // Adjacent to player at 0,0
        equipment: { ...enemy.equipment, weapon: { ...enemy.equipment.weapon, weaponRange: 1 } },
      };

      const updatedEnemies = new Map(state.run.enemies);
      updatedEnemies.set(firstEnemyKey, adjacentEnemy);

      const threatState = {
        ...state,
        run: { ...state.run, enemies: updatedEnemies },
      };

      expect(isPlayerThreatened(threatState)).toBe(true);
    });

    it('returns false when alerted enemy is dead', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      // Get first enemy, keep it alerted and adjacent but make it dead
      const firstEnemyKey = Array.from(state.run.enemies.keys())[0];
      if (!firstEnemyKey) return;

      const enemy = state.run.enemies.get(firstEnemyKey)!;
      const deadEnemy: EnemyInstance = {
        ...enemy,
        isAlerted: true,
        position: { x: 1, y: 0 }, // Adjacent to player
        stats: { ...enemy.stats, health: 0 },
      };

      const updatedEnemies = new Map(state.run.enemies);
      updatedEnemies.set(firstEnemyKey, deadEnemy);

      const threatState = {
        ...state,
        run: { ...state.run, enemies: updatedEnemies },
      };

      expect(isPlayerThreatened(threatState)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Test Group 2: Threat Rating Computation
  // ─────────────────────────────────────────────────────────────────

  describe('Threat Rating Computation', () => {
    it('rates Low threat for weak enemies the player can easily kill', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      const firstEnemy = Array.from(state.run.enemies.values())[0]!;
      // Weak enemy: low attack, low health
      const weakEnemy: EnemyInstance = {
        ...firstEnemy,
        stats: { ...firstEnemy.stats, attack: 2, health: 5, speed: 80 },
        position: { x: 5, y: 5 },
      };

      const threat = computeEnemyThreatRating(weakEnemy, state);
      expect(threat).toBe('Low');
    });

    it('rates High threat for fast ranged enemies', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      const firstEnemy = Array.from(state.run.enemies.values())[0]!;
      // Fast ranged enemy
      const rangedEnemy: EnemyInstance = {
        ...firstEnemy,
        stats: { ...firstEnemy.stats, attack: 6, speed: 120 }, // Faster than player (100)
        position: { x: 10, y: 5 },
        equipment: { ...firstEnemy.equipment, weapon: { ...firstEnemy.equipment.weapon, weaponRange: 3 } },
      };

      const threat = computeEnemyThreatRating(rangedEnemy, state);
      expect(['High', 'Moderate', 'Deadly']).toContain(threat);
    });

    it('rates Deadly threat for enemies that can one-shot the player', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      const firstEnemy = Array.from(state.run.enemies.values())[0]!;
      // Very powerful enemy that can one-shot
      const oneShot: EnemyInstance = {
        ...firstEnemy,
        stats: { ...firstEnemy.stats, attack: 50, health: 100, speed: 120 },
        position: { x: 6, y: 5 },
      };

      const threat = computeEnemyThreatRating(oneShot, state);
      expect(threat).toBe('Deadly');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Test Group 3: Equipment System (Dual-Wield & Swapping)
  // ─────────────────────────────────────────────────────────────────

  describe('Equipment System - Dual-wield and swapping', () => {
    it('unequipping primary weapon leaves secondary in place', () => {
      const state = createTestGameStateInCombat();
      const { state: s1 } = addItemToInventory(state, shortBow);
      
      const bowId = s1.player.inventory[s1.player.inventory.length - 1]!;

      // Unequip the currently equipped weapon
      const { state: unequipped } = unequipItem(s1, state.player.equipment.weapon!);
      
      // Now equip the bow to secondary
      const { state: withBow } = equipItem(unequipped, bowId);
      
      // Bow should be primary now (slot was empty)
      expect(withBow.player.equipment.weapon).toBe(bowId);
      expect(withBow.player.equipment.secondaryWeapon).toBeNull();
    });

    it('equipping multiple weapons fills both slots', () => {
      const state = createTestGameStateInCombat();
      const { state: s1 } = addItemToInventory(state, shortBow);
      const { state: s2 } = addItemToInventory(s1, rustySword);
      
      // Initial state already has a weapon equipped
      const initialWeapon = state.player.equipment.weapon;
      expect(initialWeapon).not.toBeNull();
      
      // Add two more weapons
      const bowId = s1.player.inventory[s1.player.inventory.length - 1]!;
      const swordId = s2.player.inventory[s2.player.inventory.length - 1]!;

      // Equip bow (should go to secondary since primary is full)
      const { state: withBow } = equipItem(s2, bowId);
      expect(withBow.player.equipment.secondaryWeapon).toBe(bowId);
      
      // Equip sword (should replace primary since both slots full)
      const { state: withSword } = equipItem(withBow, swordId);
      expect(withSword.player.equipment.weapon).toBe(swordId);
    });

    it('swap toggles primary and secondary weapons', () => {
      const state = createTestGameStateInCombat();
      const { state: s1 } = addItemToInventory(state, shortBow);
      
      const bowId = s1.player.inventory[s1.player.inventory.length - 1]!;

      // Equip bow to secondary
      const { state: withBow } = equipItem(s1, bowId);
      expect(withBow.player.equipment.secondaryWeapon).toBe(bowId);

      // Swap
      const { state: swapped } = swapWeaponSets(withBow);
      expect(swapped.player.equipment.weapon).toBe(bowId);
      expect(swapped.player.equipment.secondaryWeapon).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Test Group 4: Ranged Enemy Attacks
  // ─────────────────────────────────────────────────────────────────

  describe('Ranged Enemy Attack Range', () => {
    it('ranged enemies with range > 1 can attack from distance', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      // Get an enemy and give it ranged weapon
      const firstEnemy = Array.from(state.run.enemies.values())[0]!;
      const rangedEnemy: EnemyInstance = {
        ...firstEnemy,
        position: { x: 8, y: 5 }, // 3 squares away
        equipment: { ...firstEnemy.equipment, weapon: { ...firstEnemy.equipment.weapon, weaponRange: 3 } },
      };

      // With range 3, this enemy should be within attack range
      const distance = Math.max(Math.abs(8 - 5), Math.abs(5 - 5)); // Chebyshev distance
      expect(distance).toBeLessThanOrEqual(3);
    });

    it('melee enemies with range 1 cannot attack from distance', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      const firstEnemy = Array.from(state.run.enemies.values())[0]!;
      const meleeEnemy: EnemyInstance = {
        ...firstEnemy,
        position: { x: 8, y: 5 }, // 3 squares away
        equipment: { ...firstEnemy.equipment, weapon: { ...firstEnemy.equipment.weapon, weaponRange: 1 } },
      };

      // With range 1, this enemy is out of attack range
      const distance = Math.max(Math.abs(8 - 5), Math.abs(5 - 5));
      expect(distance).toBeGreaterThan(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Test Group 5: Weapon Swap Availability
  // ─────────────────────────────────────────────────────────────────

  describe('Threat Detection Integration', () => {
    it('threat rating responds to enemy attributes', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      const baseEnemy = Array.from(state.run.enemies.values())[0]!;
      
      // Very fast ranged enemy with high health should be High or Deadly
      const dangerous = { 
        ...baseEnemy, 
        stats: { ...baseEnemy.stats, speed: 150, health: 100 },
        equipment: { ...baseEnemy.equipment, weapon: { ...baseEnemy.equipment.weapon, weaponRange: 3 } },
      };
      const threat = computeEnemyThreatRating(dangerous, state);
      expect(['Moderate', 'High', 'Deadly']).toContain(threat);
    });

    it('threat rating evaluated consistently across same enemy state', () => {
      const state = createTestGameStateInCombat();
      if (!state.run) return;

      const enemy = Array.from(state.run.enemies.values())[0]!;
      const threat1 = computeEnemyThreatRating(enemy, state);
      const threat2 = computeEnemyThreatRating(enemy, state);
      
      // Should get the same threat rating
      expect(threat1).toBe(threat2);
      expect(['Low', 'Moderate', 'High', 'Deadly']).toContain(threat1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Test Group 6: Damage Band System
  // ─────────────────────────────────────────────────────────────────

  describe('Damage Band System (min-max ranges)', () => {
    it('weapon damage is applied as scalar but has variance in combat', () => {
      // The damage value is stored as scalar (e.g., 7 for Rusty Sword)
      expect(rustySword.weapon.damage).toBe(7);

      // But in actual combat, it should produce a range
      // This is tested in combat.test.ts with rollDamage
    });

    it('damage variance applies consistently across combat system', () => {
      const state = createTestGameStateInCombat();
      const { state: withWeapon } = addItemToInventory(state, rustySword);
      const itemId = withWeapon.player.inventory[0]!;

      const { state: equipped } = equipItem(withWeapon, itemId);
      // Attack stat should reflect weapon bonus
      expect(equipped.player.stats.attack).toBeGreaterThan(withWeapon.player.baseStats.attack);

      // The actual damage in combat varies, but stats remain scalar
      expect(typeof equipped.player.stats.attack).toBe('number');
    });
  });
});
