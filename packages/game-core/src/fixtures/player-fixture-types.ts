/**
 * PlayerFixture — schema type for player fixture files.
 *
 * Represents player state using domain concepts (item IDs, spell IDs, school IDs)
 * rather than raw GameState internals. Fixture files remain stable even if
 * internal runtime structures evolve.
 *
 * Forbidden in fixtures (runtime-only data):
 *   - rendering / animation state
 *   - UI state
 *   - cached calculations
 *   - temporary engine bookkeeping
 *   - entity EntityId values (resolved at load time)
 */

import type { RingSchool } from '@dungeon/content';
import type { Player, ItemRegistry } from '@dungeon/contracts';

/**
 * Armor slots that can be specified in a fixture.
 * Excludes the weapon slot (which has its own top-level field) and ring slots
 * (handled via activeEquipmentIds).
 */
export interface FixtureArmorSlots {
  readonly chest?: string;
  readonly head?: string;
  readonly gloves?: string;
  readonly boots?: string;
  readonly secondaryWeapon?: string;
}

/**
 * Ring equipment slots for active ring accessories.
 */
export interface FixtureActiveEquipment {
  readonly ring1?: string;
  readonly ring2?: string;
}

/**
 * Fixture validation error — identifies the offending field and describes the
 * problem clearly enough for a developer to fix the fixture file.
 */
export interface FixtureValidationError {
  /** Dot-path to the offending field, e.g. "gold", "inventoryItemIds[0]" */
  readonly field: string;
  /** Human-readable description identifying the bad value and why it is invalid */
  readonly message: string;
}

/**
 * Result returned by validatePlayerFixture().
 */
export interface FixtureValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly FixtureValidationError[];
}

/**
 * Result returned by loadPlayerFromFixture().
 *
 * Returns both the Player and an ItemRegistry pre-populated with every item
 * template referenced by the fixture (equipped + inventory). Callers must
 * merge this itemRegistry into the GameState so that runtime systems
 * (combat preview, equipment validator, inventory) can resolve item lookups.
 */
export interface FixtureLoadResult {
  readonly player: Player;
  readonly itemRegistry: ItemRegistry;
}

/**
 * PlayerFixture schema version 1.
 *
 * All fields except schemaVersion and level are optional; omitted fields
 * receive content-authoritative defaults at load time.
 */
export interface PlayerFixture {
  /** Must equal FIXTURE_SCHEMA_VERSION (currently 1). */
  readonly schemaVersion: number;

  /** Player level (≥ 1). */
  readonly level: number;

  /** Total experience points accumulated (≥ 0, default 0). */
  readonly experience?: number;

  /**
   * Current health. Must be ≤ maxHealth when both are specified.
   * Defaults to maxHealth derived from level + base stats.
   */
  readonly health?: number;

  /**
   * Maximum health override.
   * Defaults to base stats + level-up gains for the given level.
   */
  readonly maxHealth?: number;

  /** Current mana (≥ 0, must be ≤ maxMana when both are specified, default MAGIC.initialMana). */
  readonly mana?: number;

  /** Maximum mana (≥ 0, default MAGIC.initialMana). */
  readonly maxMana?: number;

  /** Gold held (≥ 0, default 0). */
  readonly gold?: number;

  /**
   * Item ID of the weapon to equip (e.g. "iron_sword").
   * Must exist in ITEM_BY_ID.
   */
  readonly equippedWeaponId?: string;

  /**
   * Item IDs for non-weapon, non-ring armor slots.
   * Each value must exist in ITEM_BY_ID.
   */
  readonly equippedArmorIds?: FixtureArmorSlots;

  /**
   * Ordered list of item IDs to place in the inventory.
   * Duplicate IDs are allowed (each creates a separate stack entry).
   * Each must exist in ITEM_BY_ID.
   */
  readonly inventoryItemIds?: readonly string[];

  /**
   * Ring schools the player has unlocked access to.
   * Each must be a valid RingSchool.
   * Controls which schools appear in ringMastery.
   */
  readonly knownRingSchools?: readonly RingSchool[];

  /**
   * Ring mastery XP per school. Keys must be valid RingSchool values.
   * Values must be { xp: number } with xp ≥ 0.
   */
  readonly ringMastery?: Partial<Record<RingSchool, { readonly xp: number }>>;

  /**
   * Ring spell IDs the player has learned (e.g. "ember", "bolt").
   * Each must exist in RING_SPELL_BY_ID.
   */
  readonly learnedRingSpellIds?: readonly string[];

  /**
   * Ring accessory slots (ring1, ring2).
   * Item IDs must exist in ITEM_BY_ID.
   */
  readonly activeEquipmentIds?: FixtureActiveEquipment;
}
