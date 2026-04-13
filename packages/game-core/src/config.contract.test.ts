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
import { GameCommandSchema } from '@dungeon/contracts';

/**
 * Contract Tests: Game Config Integrity
 *
 * Validates that all game configuration files (abilities, enemies, items, balance)
 * meet structural requirements and have reasonable value ranges.
 *
 * These tests catch typos, missing fields, and value ranges without asserting
 * exact values (which would be brittle).
 */

// =============================================================================
// 1. ABILITY REGISTRY VALIDATION (2 tests)
// =============================================================================

describe('Ability Registry Contract', () => {
  it('all abilities have required fields (id, name, cooldown)', () => {
    const abilities = Object.values(ABILITY_DEFINITIONS);
    expect(abilities.length).toBeGreaterThan(0);

    for (const ability of abilities) {
      expect(ability.id, `Ability missing id`).toBeDefined();
      expect(typeof ability.id).toBe('string');
      expect(ability.id.length).toBeGreaterThan(0);

      expect(ability.name, `${ability.id} missing name`).toBeDefined();
      expect(typeof ability.name).toBe('string');
      expect(ability.name.length).toBeGreaterThan(0);

      expect(ability.cooldown, `${ability.id} missing cooldown`).toBeDefined();
      expect(typeof ability.cooldown).toBe('number');
      expect(Number.isInteger(ability.cooldown)).toBe(true);
    }
  });

  it('no duplicate ability IDs and all cooldowns are in valid ranges', () => {
    const abilities = Object.values(ABILITY_DEFINITIONS);
    const ids = new Set<string>();

    for (const ability of abilities) {
      // Check for duplicates
      expect(ids.has(ability.id), `Duplicate ability ID: ${ability.id}`).toBe(false);
      ids.add(ability.id);

      // Cooldown ranges: 0-100 is reasonable for a game
      expect(
        ability.cooldown,
        `${ability.id} cooldown out of range: ${ability.cooldown}`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        ability.cooldown,
        `${ability.id} cooldown suspiciously high: ${ability.cooldown}`,
      ).toBeLessThanOrEqual(100);
    }
  });
});

// =============================================================================
// 2. ENEMY TEMPLATES VALIDATION (3 tests)
// =============================================================================

describe('Enemy Templates Contract', () => {
  it('all enemies have required stats (health, attack, defense)', () => {
    const enemies = Array.from(ENEMY_TEMPLATES.values());
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
    const enemies = Array.from(ENEMY_TEMPLATES.values());

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
    }
  });

  it('no duplicate enemy template IDs', () => {
    const enemies = Array.from(ENEMY_TEMPLATES.values());
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
  it('all items have required properties and valid rarity tiers', () => {
    expect(ALL_ITEMS.length).toBeGreaterThan(0);

    const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

    for (const item of ALL_ITEMS) {
      expect(item.itemId, 'Item missing itemId').toBeDefined();
      expect(typeof item.itemId).toBe('string');
      expect(item.itemId.length).toBeGreaterThan(0);

      expect(item.name, `${item.itemId} missing name`).toBeDefined();
      expect(typeof item.name).toBe('string');

      expect(item.itemClass, `${item.itemId} missing itemClass`).toBeDefined();
      expect(
        ['weapon', 'armor', 'consumable'].includes(item.itemClass),
        `${item.itemId} has invalid itemClass: ${item.itemClass}`,
      ).toBe(true);

      expect(
        validRarities.includes(item.rarity),
        `${item.itemId} has invalid rarity: ${item.rarity}`,
      ).toBe(true);

      expect(item.value, `${item.itemId} missing value`).toBeDefined();
      expect(
        typeof item.value,
        `${item.itemId} value is not a number: ${item.value}`,
      ).toBe('number');
      expect(
        item.value,
        `${item.itemId} has negative value: ${item.value}`,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('all item IDs in ITEM_BY_ID exist and no duplicates', () => {
    const seenIds = new Set<string>();

    for (const item of ALL_ITEMS) {
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

    expect(ITEM_BY_ID.size).toBe(ALL_ITEMS.length);
  });
});

// =============================================================================
// 4. GAME BALANCE THRESHOLDS VALIDATION (2 tests)
// =============================================================================

describe('Game Balance Thresholds Contract', () => {
  it('player start stats are within expected ranges', () => {
    // BASE_PLAYER_STATS should be reasonable starting values
    const { maxHealth, health, attack, defense, accuracy, evasion, speed } =
      BASE_PLAYER_STATS;

    // All stats should be positive integers
    expect(Number.isInteger(maxHealth)).toBe(true);
    expect(Number.isInteger(attack)).toBe(true);
    expect(Number.isInteger(defense)).toBe(true);
    expect(Number.isInteger(accuracy)).toBe(true);
    expect(Number.isInteger(evasion)).toBe(true);
    expect(Number.isInteger(speed)).toBe(true);

    // Ranges should be reasonable (1-500)
    expect(maxHealth).toBeGreaterThan(0);
    expect(maxHealth).toBeLessThan(500);
    expect(attack).toBeGreaterThan(0);
    expect(attack).toBeLessThan(500);
    expect(defense).toBeGreaterThan(0);
    expect(defense).toBeLessThan(500);

    // Accuracy and evasion should be percentages (0-100)
    expect(accuracy).toBeGreaterThanOrEqual(0);
    expect(accuracy).toBeLessThanOrEqual(100);
    expect(evasion).toBeGreaterThanOrEqual(0);
    expect(evasion).toBeLessThanOrEqual(100);
  });

  it('difficulty modifiers and balance values are reasonable', () => {
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

    // Level-up gains should be positive or zero
    for (const [stat, gain] of Object.entries(LEVEL_UP_GAINS)) {
      expect(
        gain,
        `${stat} gain is negative: ${gain}`,
      ).toBeGreaterThanOrEqual(0);
    }
  });
});

// =============================================================================
// 5. STATE SCHEMA INTEGRITY (2 tests)
// =============================================================================

describe('Game State Schema Contract', () => {
  it('GameCommandSchema validates all command types', () => {
    // Test that the discriminated union parses various command types
    const validCommands = [
      { type: 'MOVE', direction: 'N' },
      { type: 'ATTACK', targetId: 'enemy-1' },
      { type: 'WAIT' },
      { type: 'RETREAT' },
      { type: 'EQUIP', itemId: 'sword-1' },
      { type: 'UNEQUIP', itemId: 'armor-1' },
    ];

    for (const cmd of validCommands) {
      const result = GameCommandSchema.safeParse(cmd);
      expect(
        result.success,
        `Command failed to parse: ${JSON.stringify(cmd)} - ${result.error?.message}`,
      ).toBe(true);
    }
  });

  it('GameCommandSchema rejects invalid commands', () => {
    const invalidCommands = [
      { type: 'INVALID_TYPE' },
      { type: 'MOVE' }, // missing required direction
      { type: 'ATTACK' }, // missing required targetId
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
// 6. CROSS-REFERENCE VALIDATION (Bonus tests)
// =============================================================================

describe('Cross-Reference Validation Contract', () => {
  it('all enemies and items exist in their respective collections', () => {
    // Verify ENEMY_TEMPLATES map can be iterated
    let count = 0;
    for (const [id, enemy] of ENEMY_TEMPLATES) {
      expect(id).toBe(enemy.templateId);
      count++;
    }
    expect(count).toBeGreaterThan(0);

    // Verify ALL_ITEMS can be iterated
    let itemCount = 0;
    for (const item of ALL_ITEMS) {
      expect(item.itemId).toBeDefined();
      itemCount++;
    }
    expect(itemCount).toBeGreaterThan(0);

    // Verify ABILITY_DEFINITIONS can be iterated
    let abilityCount = 0;
    for (const ability of Object.values(ABILITY_DEFINITIONS)) {
      expect(ability.id).toBeDefined();
      abilityCount++;
    }
    expect(abilityCount).toBeGreaterThan(0);
  });

  it('config collections are not empty', () => {
    expect(Object.keys(ABILITY_DEFINITIONS).length).toBeGreaterThan(0);
    expect(ENEMY_TEMPLATES.size).toBeGreaterThan(0);
    expect(ALL_ITEMS.length).toBeGreaterThan(0);
    expect(ITEM_BY_ID.size).toBeGreaterThan(0);
  });
});
