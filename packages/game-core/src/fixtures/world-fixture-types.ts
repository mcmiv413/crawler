/**
 * WorldFixture — schema type for world fixture files.
 *
 * Represents WorldState using domain concepts (faction IDs, ogre status)
 * rather than raw GameState internals. Fixture files remain stable even if
 * internal runtime structures evolve.
 *
 * Forbidden in fixtures (runtime-only data):
 *   - event history (generated at runtime)
 *   - NPC dialogue state
 *   - map/floor generation data
 *   - shop transaction logs
 *   - entity EntityId values
 *
 * Required: schemaVersion only.
 * All other fields are optional; omitted fields receive content-authoritative
 * defaults at load time.
 */

/**
 * Per-faction override within a fixture.
 * Specifies only the fields the test scenario needs to differ from defaults.
 * Non-specified fields use content-derived initial values.
 */
export interface FixtureFactionOverride {
  /** Must be a valid faction ID (e.g. "goblin_warband"). Checked against FACTION_DEFINITIONS. */
  readonly id: string;

  /**
   * Faction power level (0–100).
   * Required in an override — if you list a faction, you must set its power.
   */
  readonly power: number;

  /**
   * Faction disposition toward the player (-100 to 100).
   * Required in an override — if you list a faction, you must set its disposition.
   */
  readonly disposition: number;
}

/**
 * Dungeon Ogre state within a fixture.
 * Maps directly to DungeonOgreState, minus the id (always 'dungeon_ogre').
 */
export interface FixtureDungeonOgre {
  /** Must be 'sealed' | 'emerged' | 'slain'. */
  readonly status: 'sealed' | 'emerged' | 'slain';

  /** Run number after which the ogre emerged. Only meaningful when status is 'emerged' or 'slain'. */
  readonly emergedAfterRun?: number;

  /** Dungeon depth at which the ogre emerged. Only meaningful when status is 'emerged' or 'slain'. */
  readonly emergedAtDepth?: number;
}

/**
 * Town state override within a fixture.
 * All fields are optional; omitted fields receive defaults (prosperity=50, fear=20, corruption=10).
 */
export interface FixtureTownState {
  /** Town prosperity level (0–100, default 50). */
  readonly prosperity?: number;

  /** Town fear level (0–100, default 20). */
  readonly fear?: number;

  /** Town corruption level (0–100, default 10). */
  readonly corruption?: number;
}

/**
 * Fixture validation error — identifies the offending field and describes
 * the problem clearly enough for a developer to fix the fixture file.
 */
export interface WorldFixtureValidationError {
  /** Dot-path to the offending field, e.g. "factions[0].power", "dungeonOgre.status" */
  readonly field: string;
  /** Human-readable description identifying the bad value and why it is invalid */
  readonly message: string;
}

/**
 * Result returned by validateWorldFixture().
 */
export interface WorldFixtureValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly WorldFixtureValidationError[];
}

/**
 * WorldFixture schema version 1.
 *
 * Only schemaVersion is required. All other fields default to the content-
 * authoritative initial state at load time.
 *
 * Scope: factions, dungeonOgre, basic town state, totalRuns, deepestFloor,
 * highestRarityFound.
 *
 * Out of scope for Phase 2: NPC dialogue, shop inventory, active quests,
 * unlocked blueprints, map generation.
 */
export interface WorldFixture {
  /** Must equal WORLD_FIXTURE_SCHEMA_VERSION (currently 1). */
  readonly schemaVersion: number;

  /**
   * Per-faction overrides. Only listed factions are overridden; unlisted
   * factions receive content-derived initial power and disposition.
   * Each faction ID must exist in FACTION_DEFINITIONS.
   * Duplicate IDs are forbidden.
   */
  readonly factions?: readonly FixtureFactionOverride[];

  /**
   * Dungeon Ogre state override.
   * Defaults to { status: 'sealed' } when omitted.
   */
  readonly dungeonOgre?: FixtureDungeonOgre;

  /**
   * Town state override.
   * Any omitted sub-fields receive their defaults.
   */
  readonly town?: FixtureTownState;

  /**
   * Total number of runs completed (≥ 0, default 0).
   */
  readonly totalRuns?: number;

  /**
   * Deepest dungeon floor reached (≥ 0, default 0).
   */
  readonly deepestFloor?: number;

  /**
   * Highest item rarity found so far (default 'common').
   */
  readonly highestRarityFound?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}
