/**
 * Test layer: unit
 * Behavior: Player Fixture covers Group 1: Minimal fixture creates valid player with defaults; validates a minimal fixture without errors; loads a minimal fixture into a P....
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/fixtures/player-fixture.test.ts
 */
/**
 * Player Fixture System Tests
 *
 * Test-first (TDD) suite covering all 6 groups from the plan:
 *   Group 1 - Minimal fixture creates valid player with defaults
 *   Group 2 - Fully populated fixture matches exactly
 *   Group 4 - Domain equivalence (fixture vs gameplay-created players)
 *   Group 5 - Deterministic reproducibility
 *   Group 6 - Save compatibility (serialize loaded player)
 *
 * Note: Group 3 (validation failures that check live content IDs) lives in
 * tests/contracts/player-fixture-validation.contract.test.ts
 */

import { describe, it, expect } from 'vitest';
import { serializeState } from '../state/serialization.js';
import { createTestGameState } from '../test-utils.js';
import {
  validatePlayerFixture,
  loadPlayerFromFixture,
  FIXTURE_SCHEMA_VERSION,
} from './player-fixture-loader.js';
import type { PlayerFixture } from './player-fixture-types.js';
import type { FixtureLoadResult } from './player-fixture-types.js';

// ─── Minimal fixture (only schemaVersion + level required) ───────────────────

const MINIMAL_FIXTURE: PlayerFixture = {
  schemaVersion: 1,
  level: 1,
};

// ─── Fully populated fixture ──────────────────────────────────────────────────

const FULL_FIXTURE: PlayerFixture = {
  schemaVersion: 1,
  level: 5,
  experience: 650,
  health: 60,
  maxHealth: 76,
  mana: 15,
  maxMana: 20,
  gold: 250,
  equippedWeaponId: 'iron_sword',
  equippedArmorIds: {
    chest: 'chain_shirt',
    head: 'iron_helm',
    gloves: 'leather_gloves',
    boots: 'leather_boots',
  },
  inventoryItemIds: ['health_potion', 'health_potion', 'mana_potion'],
  knownRingSchools: ['fire'],
  ringMastery: {
    fire: { xp: 25 },
  },
  learnedRingSpellIds: ['ember', 'bolt'],
  activeEquipmentIds: {
    ring1: 'fire_ring',
  },
};

// ─── Group 1: Minimal Fixture ─────────────────────────────────────────────────

describe('Group 1: Minimal fixture creates valid player with defaults', () => {
  it('validates a minimal fixture without errors', () => {
    const result = validatePlayerFixture(MINIMAL_FIXTURE);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('loads a minimal fixture into a Player', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player).toBeDefined();
    expect(player.level).toBe(1);
  });

  it('applies default experience of 0', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player.experience).toBe(0);
  });

  it('applies default gold of 0', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player.gold).toBe(0);
  });

  it('applies default base stats with positive values', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player.stats.maxHealth).toBeGreaterThan(0);
    expect(player.stats.attack).toBeGreaterThan(0);
    expect(player.stats.defense).toBeGreaterThanOrEqual(0);
  });

  it('applies default mana with non-negative values', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player.mana).toBeGreaterThanOrEqual(0);
    expect(player.maxMana).toBeGreaterThanOrEqual(0);
    expect(player.mana).toBeLessThanOrEqual(player.maxMana);
  });

  it('creates player with empty inventory', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player.inventory).toHaveLength(0);
  });

  it('creates player with no equipped items', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player.equipment.weapon).toBeNull();
    expect(player.equipment.chest).toBeNull();
    expect(player.equipment.ring1).toBeNull();
    expect(player.equipment.ring2).toBeNull();
  });

  it('creates player with empty ring mastery', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player.ringMastery).toEqual({});
  });

  it('creates player with no learned ring spells', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player.learnedRingSpellIds).toHaveLength(0);
  });

  it('creates player with no status effects', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player.statuses).toHaveLength(0);
  });

  it('produces a Player with a valid non-empty id', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(typeof player.id).toBe('string');
    expect(player.id.length).toBeGreaterThan(0);
  });
});

// ─── Group 2: Fully Populated Fixture ────────────────────────────────────────

describe('Group 2: Fully populated fixture matches exactly', () => {
  it('validates the full fixture without errors', () => {
    const result = validatePlayerFixture(FULL_FIXTURE);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('sets level exactly', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.level).toBe(5);
  });

  it('sets experience exactly', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.experience).toBe(650);
  });

  it('sets health exactly', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.stats.health).toBe(60);
  });

  it('sets maxHealth exactly', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.stats.maxHealth).toBe(76);
  });

  it('sets mana exactly', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.mana).toBe(15);
  });

  it('sets maxMana exactly', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.maxMana).toBe(20);
  });

  it('sets gold exactly', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.gold).toBe(250);
  });

  it('equips the specified weapon', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.equipment.weapon).not.toBeNull();
  });

  it('equips the specified armor pieces', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.equipment.chest).not.toBeNull();
    expect(player.equipment.head).not.toBeNull();
    expect(player.equipment.gloves).not.toBeNull();
    expect(player.equipment.boots).not.toBeNull();
  });

  it('populates the inventory with correct count', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.inventory).toHaveLength(3);
  });

  it('sets ring mastery xp for fire school', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.ringMastery['fire']).toBeDefined();
    expect(player.ringMastery['fire']!.xp).toBe(25);
  });

  it('sets learned ring spells exactly', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.learnedRingSpellIds).toContain('ember');
    expect(player.learnedRingSpellIds).toContain('bolt');
    expect(player.learnedRingSpellIds).toHaveLength(2);
  });

  it('equips the ring in ring1 slot', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.equipment.ring1).not.toBeNull();
  });

  it('has no unexpected status effects', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.statuses).toHaveLength(0);
  });
});

// ─── Group 4: Domain Equivalence ─────────────────────────────────────────────

describe('Group 4: Domain equivalence — fixture player matches gameplay-created player', () => {
  it('fixture player level matches a player created via createTestPlayer', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    const gameplayPlayer = createTestGameState().player;
    expect(fixturePlayer.level).toBe(gameplayPlayer.level);
  });

  it('fixture player base stats match gameplay player base stats at level 1', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    const gameplayPlayer = createTestGameState().player;
    expect(fixturePlayer.baseStats.maxHealth).toBe(gameplayPlayer.baseStats.maxHealth);
    expect(fixturePlayer.baseStats.attack).toBe(gameplayPlayer.baseStats.attack);
    expect(fixturePlayer.baseStats.defense).toBe(gameplayPlayer.baseStats.defense);
  });

  it('fixture player mana matches default gameplay player mana', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    const gameplayPlayer = createTestGameState().player;
    expect(fixturePlayer.mana).toBe(gameplayPlayer.mana);
    expect(fixturePlayer.maxMana).toBe(gameplayPlayer.maxMana);
  });

  it('fixture player has same empty ring mastery shape as gameplay player', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    const gameplayPlayer = createTestGameState().player;
    expect(fixturePlayer.ringMastery).toEqual(gameplayPlayer.ringMastery);
    expect(fixturePlayer.learnedRingSpellIds).toEqual(gameplayPlayer.learnedRingSpellIds);
  });

  it('fixture player has same equipment structure as gameplay player (all null slots)', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    const gameplayPlayer = createTestGameState().player;
    // Both should have all-null equipment
    for (const slot of ['weapon', 'secondaryWeapon', 'chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'] as const) {
      expect(fixturePlayer.equipment[slot]).toBe(gameplayPlayer.equipment[slot]);
    }
  });

  it('fixture player gold of 50 matches createTestPlayer gold override', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture({ schemaVersion: 1, level: 1, gold: 50 });
    const gameplayPlayer = createTestGameState({ player: { gold: 50 } }).player;
    expect(fixturePlayer.gold).toBe(gameplayPlayer.gold);
  });

  it('fixture player with ring spells has same learnedRingSpellIds as gameplay player with spells', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture({
      schemaVersion: 1,
      level: 1,
      learnedRingSpellIds: ['ember'],
    });
    expect(fixturePlayer.learnedRingSpellIds).toContain('ember');
    expect(fixturePlayer.learnedRingSpellIds).toHaveLength(1);
  });

  it('fixture player has no fixture-specific runtime fields absent from gameplay players', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    // Must not have any properties beyond the Player interface
    const allowedKeys = new Set([
      'id', 'name', 'level', 'experience', 'stats', 'baseStats', 'position',
      'equipment', 'inventory', 'statuses', 'abilities', 'gold', 'floor',
      'totalKills', 'totalDeaths', 'totalRuns', 'deathStash', 'mana', 'maxMana',
      'ringMastery', 'learnedRingSpellIds', 'knownRingSchools',
    ]);
    for (const key of Object.keys(fixturePlayer)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });
});

// ─── Group 5: Deterministic Reproducibility ───────────────────────────────────

describe('Group 5: Deterministic reproducibility', () => {
  it('loading the same fixture twice produces identical results', () => {
    const { player: player1 } = loadPlayerFromFixture(FULL_FIXTURE);
    const { player: player2 } = loadPlayerFromFixture(FULL_FIXTURE);
    // All scalar fields must be identical
    expect(player1.level).toBe(player2.level);
    expect(player1.experience).toBe(player2.experience);
    expect(player1.gold).toBe(player2.gold);
    expect(player1.mana).toBe(player2.mana);
    expect(player1.maxMana).toBe(player2.maxMana);
    expect(player1.stats.health).toBe(player2.stats.health);
    expect(player1.stats.maxHealth).toBe(player2.stats.maxHealth);
    expect(player1.ringMastery).toEqual(player2.ringMastery);
    expect(player1.learnedRingSpellIds).toEqual(player2.learnedRingSpellIds);
  });

  it('loading the minimal fixture 10 times always produces level 1', () => {
    for (let i = 0; i < 10; i++) {
      const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
      expect(player.level).toBe(1);
    }
  });

  it('loading the full fixture 10 times always produces the same gold', () => {
    const expected = loadPlayerFromFixture(FULL_FIXTURE).player.gold;
    for (let i = 0; i < 10; i++) {
      const { player } = loadPlayerFromFixture(FULL_FIXTURE);
      expect(player.gold).toBe(expected);
    }
  });

  it('fixture loading does not use Math.random (inventory length stable)', () => {
    const counts = new Set<number>();
    for (let i = 0; i < 5; i++) {
      counts.add(loadPlayerFromFixture(FULL_FIXTURE).player.inventory.length);
    }
    expect(counts.size).toBe(1);
  });

  it('inventory item entity ids are assigned deterministically (same order each time)', () => {
    const { player: player1 } = loadPlayerFromFixture(FULL_FIXTURE);
    const { player: player2 } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player1.inventory).toEqual(player2.inventory);
  });
});

// ─── Group 6: Save Compatibility ─────────────────────────────────────────────

describe('Group 6: Future save compatibility', () => {
  it('a player loaded from a fixture can be placed into a GameState and serialized', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    const state = createTestGameState({ player });
    expect(() => serializeState(state)).not.toThrow();
  });

  it('serialized fixture state produces valid JSON', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    const state = createTestGameState({ player });
    const json = serializeState(state);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('minimal fixture player can be serialized in a GameState', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    const state = createTestGameState({ player });
    const json = serializeState(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed).toHaveProperty('schemaVersion');
  });

  it('serialized player retains correct level', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    const state = createTestGameState({ player });
    const json = serializeState(state);
    const parsed = JSON.parse(json) as { player: { level: number } };
    expect(parsed.player.level).toBe(5);
  });

  it('serialized player retains correct gold', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    const state = createTestGameState({ player });
    const json = serializeState(state);
    const parsed = JSON.parse(json) as { player: { gold: number } };
    expect(parsed.player.gold).toBe(250);
  });

  it('serialized player retains ring mastery', () => {
    const { player } = loadPlayerFromFixture(FULL_FIXTURE);
    const state = createTestGameState({ player });
    const json = serializeState(state);
    const parsed = JSON.parse(json) as { player: { ringMastery: Record<string, { xp: number }> } };
    expect(parsed.player.ringMastery?.fire?.xp).toBe(25);
  });
});

// ─── FIXTURE_SCHEMA_VERSION export ───────────────────────────────────────────

describe('FIXTURE_SCHEMA_VERSION constant', () => {
  it('exports the current schema version as 1', () => {
    expect(FIXTURE_SCHEMA_VERSION).toBe(1);
  });
});

// ─── Additional coverage: edge cases ─────────────────────────────────────────

describe('Additional edge cases for coverage', () => {
  it('rejects ringMastery entry with non-object value', () => {
    const fixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: { fire: 'invalid' as unknown as { xp: number } },
    } as PlayerFixture;
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('ringMastery'));
    expect(error).toBeDefined();
  });

  it('rejects ringMastery entry with negative xp', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: { fire: { xp: -5 } },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('ringMastery'));
    expect(error).toBeDefined();
  });

  it('loads fixture with secondaryWeapon slot populated', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedArmorIds: {
        secondaryWeapon: 'rusty_sword',
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);
    const { player } = loadPlayerFromFixture(fixture);
    expect(player.equipment.secondaryWeapon).not.toBeNull();
  });

  it('rejects unknown item id in secondaryWeapon slot', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedArmorIds: {
        secondaryWeapon: 'nonexistent_secondary_weapon',
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('secondaryWeapon'));
    expect(error).toBeDefined();
    expect(error!.message).toContain('nonexistent_secondary_weapon');
  });
});

// ─── Part 1 NEW: FixtureLoadResult type ──────────────────────────────────────

describe('FixtureLoadResult: loadPlayerFromFixture returns { player, itemRegistry }', () => {
  it('returns an object with player and itemRegistry properties', () => {
    const result: FixtureLoadResult = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(result).toHaveProperty('player');
    expect(result).toHaveProperty('itemRegistry');
  });

  it('returned player is valid Player at level 1', () => {
    const { player } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(player.level).toBe(1);
    expect(player.id).toBeDefined();
  });

  it('returned itemRegistry is an object with items Map', () => {
    const { itemRegistry } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(itemRegistry).toBeDefined();
    expect(itemRegistry.items).toBeInstanceOf(Map);
  });

  it('minimal fixture with no items produces empty itemRegistry', () => {
    const { itemRegistry } = loadPlayerFromFixture(MINIMAL_FIXTURE);
    expect(itemRegistry.items.size).toBe(0);
  });

  it('full fixture: itemRegistry contains all equipped weapon entity', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.equipment.weapon).not.toBeNull();
    const weaponEntityId = player.equipment.weapon!;
    expect(itemRegistry.items.has(weaponEntityId)).toBe(true);
    const weaponTemplate = itemRegistry.items.get(weaponEntityId)!;
    expect(weaponTemplate.itemId).toBe('iron_sword');
  });

  it('full fixture: itemRegistry contains all equipped armor entities', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(FULL_FIXTURE);
    const { chest, head, gloves, boots } = player.equipment;
    expect(chest).not.toBeNull();
    expect(head).not.toBeNull();
    expect(gloves).not.toBeNull();
    expect(boots).not.toBeNull();
    for (const id of [chest!, head!, gloves!, boots!]) {
      expect(itemRegistry.items.has(id)).toBe(true);
    }
  });

  it('full fixture: itemRegistry contains ring entity', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.equipment.ring1).not.toBeNull();
    expect(itemRegistry.items.has(player.equipment.ring1!)).toBe(true);
  });

  it('full fixture: all inventory entity ids resolve in itemRegistry', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(FULL_FIXTURE);
    expect(player.inventory.length).toBe(3);
    for (const id of player.inventory) {
      expect(itemRegistry.items.has(id)).toBe(true);
    }
  });

  it('inventory items have correct itemId values', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(FULL_FIXTURE);
    const templates = player.inventory.map(id => itemRegistry.items.get(id)!);
    const itemIds = templates.map(t => t.itemId);
    expect(itemIds.filter(id => id === 'health_potion').length).toBe(2);
    expect(itemIds.filter(id => id === 'mana_potion').length).toBe(1);
  });

  it('loadPlayerFromFixture result is compatible with createTestGameState', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(FULL_FIXTURE);
    const state = createTestGameState({ player });
    // Override the empty itemRegistry with the fixture one
    const gameState = { ...state, itemRegistry };
    expect(gameState.player.level).toBe(5);
    expect(gameState.itemRegistry.items.size).toBeGreaterThan(0);
  });

  it('itemRegistry lookup for weapon returns WeaponTemplate with itemClass weapon', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(FULL_FIXTURE);
    const weaponTemplate = itemRegistry.items.get(player.equipment.weapon!)!;
    expect(weaponTemplate.itemClass).toBe('weapon');
  });

  it('itemRegistry lookup for ring returns armor/ring item', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(FULL_FIXTURE);
    const ringTemplate = itemRegistry.items.get(player.equipment.ring1!)!;
    expect(ringTemplate.itemClass).toBe('armor');
  });
});

// ─── Part 1 NEW: Slot Compatibility Validation ────────────────────────────────

describe('Slot compatibility validation', () => {
  it('rejects consumable in equippedWeaponId slot', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'health_potion',
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'equippedWeaponId');
    expect(error).toBeDefined();
    expect(error!.message).toContain('weapon');
  });

  it('rejects ring in equippedWeaponId slot (armor in weapon slot)', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'fire_ring',
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'equippedWeaponId');
    expect(error).toBeDefined();
  });

  it('rejects weapon in chest armor slot', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedArmorIds: {
        chest: 'iron_sword',
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('chest'));
    expect(error).toBeDefined();
  });

  it('rejects armor item in ring1 slot', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      activeEquipmentIds: {
        ring1: 'chain_shirt',
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('ring1'));
    expect(error).toBeDefined();
  });

  it('accepts valid weapon in equippedWeaponId', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'iron_sword',
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);
  });

  it('accepts valid chest armor in chest slot', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedArmorIds: {
        chest: 'chain_shirt',
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);
  });

  it('accepts valid ring in ring1 slot', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      activeEquipmentIds: {
        ring1: 'fire_ring',
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);
  });

  it('rejects consumable in ring slot', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      activeEquipmentIds: {
        ring2: 'health_potion',
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('ring2'));
    expect(error).toBeDefined();
  });
});

describe('Group 7: Hardened ringMastery validation — null and type safety', () => {
  it('rejects ringMastery when it is null', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: null as any,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery');
    expect(error?.message).toContain('must not be null');
  });

  it('rejects ringMastery when it is not an object', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: 'fire' as any,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery');
    expect(error?.message).toContain('must be an object');
  });

  it('rejects ringMastery when it is an array', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: ['fire'] as any,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery');
    expect(error?.message).toContain('must be an object');
  });

  it('rejects ringMastery.fire when it is null', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: {
        fire: null as any,
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery.fire');
    expect(error?.message).toContain('must be { xp: <non-negative number> }');
  });

  it('rejects ringMastery.fire when it is an empty object', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: {
        fire: {} as any,
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery.fire');
    expect(error?.message).toContain('must be { xp: <non-negative number> }');
  });

  it('rejects ringMastery.fire when xp is a string', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: {
        fire: { xp: '100' } as any,
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery.fire');
    expect(error?.message).toContain('must be { xp: <non-negative number> }');
  });

  it('rejects ringMastery.fire when xp is NaN', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: {
        fire: { xp: NaN } as any,
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery.fire');
    expect(error?.message).toContain('must be { xp: <non-negative number> }');
  });

  it('rejects ringMastery.fire when xp is Infinity', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: {
        fire: { xp: Infinity } as any,
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery.fire');
    expect(error?.message).toContain('must be { xp: <non-negative number> }');
  });

  it('rejects ringMastery.fire when xp is negative', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: {
        fire: { xp: -5 } as any,
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery.fire');
    expect(error?.message).toContain('must be { xp: <non-negative number> }');
  });

  it('accepts valid ringMastery with numeric xp', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: {
        fire: { xp: 0 },
        lightning: { xp: 100 },
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);
  });

  it('accepts undefined ringMastery', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: undefined,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);
  });

  it('rejects ringMastery.fire when level is a non-numeric string and xp is absent', () => {
    // Simulates malformed JSON: { fire: { level: "5" } } — no xp field, level is string
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: {
        fire: { level: '5' } as any,
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery.fire');
    expect(error).toBeDefined();
    expect(error?.message).toContain('must be { xp: <non-negative number> }');
  });

  it('rejects ringMastery.fire when level is a non-numeric string even when xp is valid', () => {
    // Simulates malformed JSON: { fire: { xp: 50, level: "5" } } — level must be numeric if present
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: {
        fire: { xp: 50, level: '5' } as any,
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'ringMastery.fire');
    expect(error).toBeDefined();
    expect(error?.message).toContain('level');
  });

  it('accepts ringMastery.fire with valid numeric level and xp', () => {
    // level is an optional numeric field — valid when present as a number
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      ringMastery: {
        fire: { xp: 50, level: 2 } as any,
      },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);
  });
});
