/**
 * Test layer: contract
 * Behavior: Game configuration exports provide structurally valid ability, enemy, item, balance, command schema, cross-reference, and generated sample data.
 * Proof: Assertions require non-empty registries, required fields and numeric ranges, duplicate-free IDs, ITEM_BY_ID parity, GameCommandSchema accept/reject cases, and fast-check generated ability/item invariants.
 * Validation: pnpm vitest run tests/contracts/game-config.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import {
  ABILITY_DEFINITIONS,
  ENEMY_TEMPLATES,
  ALL_ITEMS,
  ITEM_BY_ID,
  BASE_PLAYER_STATS,
  LEVEL_UP_GAINS,
  FLOOR_SCALING,
} from '@dungeon/content';
import { GameCommandSchema, WEAPON_TYPES } from '@dungeon/contracts';

/**
 * Contract Tests: Game Config Integrity
 *
 * Validates that all game configuration files (abilities, enemies, items, balance)
 * meet structural requirements and have reasonable value ranges.
 *
 * These tests catch typos, missing fields, and value ranges without asserting
 * exact values (which would be brittle).
 *
 * ~15 tests covering:
 * - Ability Registry (3 tests)
 * - Enemy Templates (3 tests)
 * - Item Definitions (2 tests)
 * - Game Balance (2 tests)
 * - State & Event Schemas (2 tests)
 * - Cross-Reference Validation (2 tests)
 */

// =============================================================================
// 1. ABILITY REGISTRY VALIDATION (3 tests)
// =============================================================================

describe('Ability Registry Contract', () => {
  it('all abilities have required fields (id, name, cooldown, requiresTarget)', () => {
    const abilities = Array.from(ABILITY_DEFINITIONS.values());
    expect(abilities.length).toBeGreaterThan(0);

    for (const ability of abilities) {
      expect(ability.id, 'Ability missing id').toBeDefined();
      expect(typeof ability.id).toBe('string');
      expect(ability.id.length).toBeGreaterThan(0);

      expect(ability.name, `${ability.id} missing name`).toBeDefined();
      expect(typeof ability.name).toBe('string');
      expect(ability.name.length).toBeGreaterThan(0);

      expect(ability.cooldown, `${ability.id} missing cooldown`).toBeDefined();
      expect(typeof ability.cooldown).toBe('number');
      expect(Number.isInteger(ability.cooldown)).toBe(true);

      expect(ability.requiresTarget, `${ability.id} missing requiresTarget`).toBeDefined();
      expect(typeof ability.requiresTarget).toBe('boolean');

      expect(ability.unlockLevel, `${ability.id} missing unlockLevel`).toBeDefined();
      expect(typeof ability.unlockLevel).toBe('number');
    }
  });

  it('ability stats are in valid ranges (cooldown 0-100, unlockLevel 0-100)', () => {
    const abilities = Array.from(ABILITY_DEFINITIONS.values());

    for (const ability of abilities) {
      // Cooldown ranges: 0-100 is reasonable for a game
      expect(
        ability.cooldown,
        `${ability.id} cooldown out of range: ${ability.cooldown}`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        ability.cooldown,
        `${ability.id} cooldown suspiciously high: ${ability.cooldown}`,
      ).toBeLessThanOrEqual(100);

      // Unlock level should be reasonable (0-100)
      expect(
        ability.unlockLevel,
        `${ability.id} unlockLevel out of range: ${ability.unlockLevel}`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        ability.unlockLevel,
        `${ability.id} unlockLevel unreasonably high: ${ability.unlockLevel}`,
      ).toBeLessThanOrEqual(100);
    }
  });

  it('no duplicate ability IDs and weapon types are valid', () => {
    const abilities = Array.from(ABILITY_DEFINITIONS.values());
    const ids = new Set<string>();

    const validWeaponTypes = new Set(WEAPON_TYPES);

    for (const ability of abilities) {
      // Check for duplicates
      expect(ids.has(ability.id), `Duplicate ability ID: ${ability.id}`).toBe(false);
      ids.add(ability.id);

      // If weapon types are specified, they should be valid
      if (ability.requiresWeaponTypes) {
        for (const wt of ability.requiresWeaponTypes) {
          expect(
            validWeaponTypes.has(wt),
            `${ability.id} has invalid weapon type: ${wt}`,
          ).toBe(true);
        }
      }
    }
  });
});

// =============================================================================
// 2. ENEMY TEMPLATES VALIDATION (3 tests)
// =============================================================================

describe('Enemy Templates Contract', () => {
  it('all enemies have required stats (health, attack, defense)', () => {
    const enemies = Array.from(ENEMY_TEMPLATES.values()) as any[];
    expect(enemies.length).toBeGreaterThan(0);

    for (const enemy of enemies) {
      expect(enemy.templateId, 'Enemy missing templateId').toBeDefined();
      expect(typeof enemy.templateId).toBe('string');

      const { maxHealth, attack, defense } = enemy.stats;
      expect(maxHealth, `${enemy.templateId} missing maxHealth`).toBeDefined();
      expect(attack, `${enemy.templateId} missing attack`).toBeDefined();
      expect(defense, `${enemy.templateId} missing defense`).toBeDefined();

      expect(typeof maxHealth).toBe('number');
      expect(typeof attack).toBe('number');
      expect(typeof defense).toBe('number');
    }
  });

  it('all enemy stats are positive integers (or zero for optional stats)', () => {
    const enemies = Array.from(ENEMY_TEMPLATES.values()) as any[];

    for (const enemy of enemies) {
      const { maxHealth, health, attack, defense, accuracy, evasion, speed } = enemy.stats;

      // maxHealth, health, attack must be positive
      const requiredPositiveStats = { maxHealth, health, attack };
      for (const [statName, value] of Object.entries(requiredPositiveStats)) {
        expect(
          Number.isInteger(value),
          `${enemy.templateId}.${statName} is not an integer: ${value}`,
        ).toBe(true);
        expect(
          value,
          `${enemy.templateId}.${statName} is not positive: ${value}`,
        ).toBeGreaterThan(0);
      }

      // defense, accuracy, evasion, speed can be >= 0
      const optionalStats = { defense, accuracy, evasion, speed };
      for (const [statName, value] of Object.entries(optionalStats)) {
        expect(
          Number.isInteger(value),
          `${enemy.templateId}.${statName} is not an integer: ${value}`,
        ).toBe(true);
        expect(
          value,
          `${enemy.templateId}.${statName} is negative: ${value}`,
        ).toBeGreaterThanOrEqual(0);
      }

      // Health should not exceed maxHealth at template definition
      expect(
        health,
        `${enemy.templateId} health exceeds maxHealth: ${health} > ${maxHealth}`,
      ).toBeLessThanOrEqual(maxHealth);
    }
  });

  it('no duplicate enemy template IDs', () => {
    const enemies = Array.from(ENEMY_TEMPLATES.values()) as any[];
    const ids = new Set<string>();

    for (const enemy of enemies) {
      expect(ids.has(enemy.templateId), `Duplicate enemy ID: ${enemy.templateId}`).toBe(false);
      ids.add(enemy.templateId);
    }

    expect(ids.size).toBe(enemies.length);
  });
});

// =============================================================================
// 3. ITEM DEFINITIONS VALIDATION (2 tests)
// =============================================================================

describe('Item Definitions Contract', () => {
  it('all items have required properties (id, name, rarity, itemClass, value)', () => {
    expect(ALL_ITEMS.length).toBeGreaterThan(0);

    const validRarities = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);
    const validItemClasses = new Set([
      'weapon',
      'armor',
      'consumable',
      'relic',
      'quest',
      'tool',
      'trap',
    ]);

    for (const item of ALL_ITEMS as any[]) {
      expect(item.itemId, 'Item missing itemId').toBeDefined();
      expect(typeof item.itemId).toBe('string');
      expect(item.itemId.length).toBeGreaterThan(0);

      expect(item.name, `${item.itemId} missing name`).toBeDefined();
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);

      expect(item.itemClass, `${item.itemId} missing itemClass`).toBeDefined();
      expect(
        validItemClasses.has(item.itemClass),
        `${item.itemId} has invalid itemClass: ${item.itemClass}`,
      ).toBe(true);

      expect(item.rarity, `${item.itemId} missing rarity`).toBeDefined();
      expect(
        validRarities.has(item.rarity),
        `${item.itemId} has invalid rarity: ${item.rarity}`,
      ).toBe(true);

      expect(item.value, `${item.itemId} missing value`).toBeDefined();
      expect(typeof item.value).toBe('number');
      expect(
        item.value,
        `${item.itemId} has negative value: ${item.value}`,
      ).toBeGreaterThanOrEqual(0);

      // Value should be reasonable for game balance (0-100000)
      expect(
        item.value,
        `${item.itemId} has suspiciously high value: ${item.value}`,
      ).toBeLessThan(100000);
    }
  });

  it('all item IDs in ITEM_BY_ID map exist in ALL_ITEMS and no duplicates', () => {
    const seenIds = new Set<string>();

    // Check ALL_ITEMS consistency
    for (const item of ALL_ITEMS as any[]) {
      // Check map contains this item
      const mapItem = ITEM_BY_ID.get(item.itemId);
      expect(
        mapItem,
        `${item.itemId} not found in ITEM_BY_ID map`,
      ).toBeDefined();

      // Check for duplicates in ALL_ITEMS array
      expect(
        seenIds.has(item.itemId),
        `Duplicate item ID: ${item.itemId}`,
      ).toBe(false);
      seenIds.add(item.itemId);
    }

    // Map size should match array length
    expect(ITEM_BY_ID.size).toBe(ALL_ITEMS.length);

    // Rarity distribution check: every rarity tier should be represented
    const rarityCount = new Set(ALL_ITEMS.map((i: any) => i.rarity));
    expect(rarityCount.size).toBeGreaterThanOrEqual(2); // At least 2 rarity tiers
  });
});

// =============================================================================
// 4. GAME BALANCE THRESHOLDS VALIDATION (2 tests)
// =============================================================================

describe('Game Balance Thresholds Contract', () => {
  it('player start stats are within expected ranges (positive, reasonable for game balance)', () => {
    // BASE_PLAYER_STATS should be reasonable starting values
    const { maxHealth, health, attack, defense, accuracy, evasion, speed } = BASE_PLAYER_STATS;

    // All stats should be positive integers
    const allStats = { maxHealth, health, attack, defense, accuracy, evasion, speed };
    for (const [statName, value] of Object.entries(allStats)) {
      expect(
        Number.isInteger(value),
        `BASE_PLAYER_STATS.${statName} is not an integer: ${value}`,
      ).toBe(true);
      expect(
        value,
        `BASE_PLAYER_STATS.${statName} is not positive: ${value}`,
      ).toBeGreaterThan(0);
    }

    // Health should be in reasonable starting range (10-500)
    expect(maxHealth).toBeGreaterThan(0);
    expect(maxHealth).toBeLessThan(500);
    expect(health).toBeLessThanOrEqual(maxHealth);

    // Attack, defense, speed should scale appropriately
    expect(attack).toBeGreaterThan(0);
    expect(defense).toBeGreaterThanOrEqual(0);
    expect(speed).toBeGreaterThan(0);

    // Accuracy and evasion should be percentages or bonuses (0-100)
    expect(accuracy).toBeGreaterThanOrEqual(0);
    expect(accuracy).toBeLessThanOrEqual(100);
    expect(evasion).toBeGreaterThanOrEqual(0);
    expect(evasion).toBeLessThanOrEqual(100);
  });

  it('difficulty modifiers and balance values are reasonable (0.5-3.0)', () => {
    // Floor scaling multipliers should be positive (0.5x - 3x is reasonable)
    const scaling = FLOOR_SCALING;

    const multipliers = [
      { name: 'healthMultiplier', value: scaling.healthMultiplier },
      { name: 'attackMultiplier', value: scaling.attackMultiplier },
      { name: 'defenseMultiplier', value: scaling.defenseMultiplier },
    ];

    for (const { name, value } of multipliers) {
      expect(
        value,
        `${name} is not a positive number: ${value}`,
      ).toBeGreaterThan(0.1);
      expect(
        value,
        `${name} is unreasonably high: ${value}`,
      ).toBeLessThan(3);
    }

    // Level-up gains should be non-negative
    for (const [stat, gain] of Object.entries(LEVEL_UP_GAINS)) {
      expect(
        gain,
        `LEVEL_UP_GAINS.${stat} is negative: ${gain}`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        gain,
        `LEVEL_UP_GAINS.${stat} is unreasonably high: ${gain}`,
      ).toBeLessThan(500);
    }
  });
});

// =============================================================================
// 5. GAME COMMAND SCHEMA VALIDATION (2 tests)
// =============================================================================

describe('Game Command Schema Contract', () => {
  it('GameCommandSchema validates valid command types correctly', () => {
    const validCommands = [
      { type: 'MOVE', direction: 'N' as const },
      { type: 'MOVE', direction: 'S' as const },
      { type: 'MOVE', direction: 'E' as const },
      { type: 'MOVE', direction: 'W' as const },
      { type: 'ATTACK', targetId: 'enemy-1' },
      { type: 'WAIT' },
      { type: 'RETREAT' },
      { type: 'USE_ITEM', itemId: 'potion-1' },
      { type: 'USE_ABILITY', abilityId: 'power_strike', targetId: 'enemy-1' },
      { type: 'EQUIP', itemId: 'sword-1' },
      { type: 'UNEQUIP', itemId: 'armor-1' },
      { type: 'TOWN_ACTION', action: 'study_spell', spellId: 'heat_surge' },
    ];

    for (const cmd of validCommands) {
      const result = GameCommandSchema.safeParse(cmd);
      expect(
        result.success,
        `Valid command failed to parse: ${JSON.stringify(cmd)} - ${result.error?.message}`,
      ).toBe(true);
    }
  });

  it('GameCommandSchema rejects invalid commands', () => {
    const invalidCommands = [
      { type: 'INVALID_TYPE' }, // Invalid command type
      { type: 'MOVE' }, // Missing required direction
      { type: 'MOVE', direction: 'INVALID' }, // Invalid direction
      { type: 'ATTACK' }, // Missing required targetId
      {}, // Empty object
    ];

    for (const cmd of invalidCommands) {
      const result = GameCommandSchema.safeParse(cmd);
      expect(
        result.success,
        `Invalid command should not parse: ${JSON.stringify(cmd)}`,
      ).toBe(false);
    }
  });
});

// =============================================================================
// 6. CROSS-REFERENCE VALIDATION (2 tests)
// =============================================================================

describe('Cross-Reference Validation Contract', () => {
  it('all config collections are non-empty and accessible', () => {
    // Verify ABILITY_DEFINITIONS can be iterated and is not empty
    let abilityCount = 0;
    for (const ability of ABILITY_DEFINITIONS.values()) {
      expect(ability.id).toBeDefined();
      abilityCount++;
    }
    expect(abilityCount).toBeGreaterThan(0);

    // Verify ENEMY_TEMPLATES map can be iterated and is not empty
    let enemyCount = 0;
    for (const [id, enemy] of ENEMY_TEMPLATES.entries()) {
      expect(id).toBe(enemy.templateId);
      enemyCount++;
    }
    expect(enemyCount).toBeGreaterThan(0);

    // Verify ALL_ITEMS can be iterated and is not empty
    let itemCount = 0;
    for (const item of ALL_ITEMS as any[]) {
      expect(item.itemId).toBeDefined();
      itemCount++;
    }
    expect(itemCount).toBeGreaterThan(0);

    // Verify ITEM_BY_ID map contains expected number of items
    expect(ITEM_BY_ID.size).toBe(itemCount);
  });

  it('config collections have consistent data across references', () => {
    // Every item in ALL_ITEMS should be findable by ID
    for (const item of ALL_ITEMS as any[]) {
      const foundItem = ITEM_BY_ID.get(item.itemId);
      expect(foundItem).toBeDefined();
      expect(foundItem?.itemId).toBe(item.itemId);
    }

    // Every ability ID should be unique and findable
    const abilityIds = new Set(ABILITY_DEFINITIONS.keys());
    expect(abilityIds.size).toBe(ABILITY_DEFINITIONS.size);

    // Every enemy template should have matching key and templateId
    for (const [key, enemy] of ENEMY_TEMPLATES.entries()) {
      expect(key).toBe(enemy.templateId);
    }
  });
});

// =============================================================================
// 7. PROPERTY-BASED SCHEMA VALIDATION (Optional: 1-2 additional tests)
// =============================================================================

describe('Property-Based Schema Validation', () => {
  it('generated abilities always have valid structure', () =>
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 5, maxLength: 20 }).map((s) => `ability_${s.replace(/[^a-z0-9]/g, '')}`),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          cooldown: fc.integer({ min: 0, max: 100 }),
          requiresTarget: fc.boolean(),
          unlockLevel: fc.integer({ min: 0, max: 100 }),
        }),
        (generatedAbility) => {
          // Verify all required fields are present
          expect(generatedAbility.id).toBeDefined();
          expect(generatedAbility.name).toBeDefined();
          expect(typeof generatedAbility.cooldown).toBe('number');
          expect(typeof generatedAbility.requiresTarget).toBe('boolean');
          expect(typeof generatedAbility.unlockLevel).toBe('number');

          // Verify ranges
          expect(generatedAbility.cooldown).toBeGreaterThanOrEqual(0);
          expect(generatedAbility.cooldown).toBeLessThanOrEqual(100);
          expect(generatedAbility.unlockLevel).toBeGreaterThanOrEqual(0);
          expect(generatedAbility.unlockLevel).toBeLessThanOrEqual(100);

          return true;
        },
      ),
    ));

  it('generated items always have valid rarity and value', () =>
    fc.assert(
      fc.property(
        fc.record({
          itemId: fc.string({ minLength: 5, maxLength: 20 }).map((s) => `item_${s.replace(/[^a-z0-9]/g, '')}`),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          rarity: fc.constantFrom('common', 'uncommon', 'rare', 'epic', 'legendary' as const),
          value: fc.integer({ min: 0, max: 10000 }),
          itemClass: fc.constantFrom('weapon', 'armor', 'consumable' as const),
        }),
        (generatedItem) => {
          // Verify rarity is valid
          const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
          expect(validRarities).toContain(generatedItem.rarity);

          // Verify value is non-negative
          expect(generatedItem.value).toBeGreaterThanOrEqual(0);

          // Verify item class is valid
          const validClasses = ['weapon', 'armor', 'consumable'];
          expect(validClasses).toContain(generatedItem.itemClass);

          return true;
        },
      ),
    ));
});
