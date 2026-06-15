/**
 * World Fixture Loader — Phase 2
 *
 * Validates and loads WorldFixture data into WorldState instances.
 * Uses existing content lookups (FACTION_DEFINITIONS, INITIAL_FACTIONS,
 * INITIAL_DUNGEON_OGRE); does not bypass validation.
 * No randomness — fixture loading is fully deterministic.
 */

import type { WorldState, FactionState, DungeonOgreState } from '@dungeon/contracts';
import { ECONOMY, FACTION_DEFINITIONS, INITIAL_FACTIONS, INITIAL_DUNGEON_OGRE } from '@dungeon/content';
import type {
  WorldFixture,
  WorldFixtureValidationError,
  WorldFixtureValidationResult,
} from './world-fixture-types.js';

/** Current supported world fixture schema version. */
export const WORLD_FIXTURE_SCHEMA_VERSION = 1;

/** Valid rarity values in upgrade order. */
const VALID_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary'] as const);

/** Valid dungeon ogre statuses. */
const VALID_OGRE_STATUSES = new Set(['sealed', 'emerged', 'slain'] as const);

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a WorldFixture for structural and content-reference correctness.
 * Returns a result with isValid flag and a list of errors, each identifying
 * the offending field and describing the problem.
 *
 * Never silently succeeds — every invalid fixture produces at least one error.
 */
export function validateWorldFixture(fixture: WorldFixture): WorldFixtureValidationResult {
  let errors: WorldFixtureValidationError[] = [];

  // schemaVersion
  if (fixture.schemaVersion !== WORLD_FIXTURE_SCHEMA_VERSION) {
    errors = [...errors, {
      field: 'schemaVersion',
      message: `Unsupported world fixture schemaVersion ${fixture.schemaVersion}. Expected ${WORLD_FIXTURE_SCHEMA_VERSION}.`,
    }];
  }

  // factions
  if (fixture.factions !== undefined) {
    const seenIds = new Set<string>();
    for (let i = 0; i < fixture.factions.length; i++) {
      const override = fixture.factions[i]!;

      // Validate faction ID exists in content
      if (!FACTION_DEFINITIONS.has(override.id)) {
        errors = [...errors, {
          field: `factions[${i}].id`,
          message: `Unknown faction id "${override.id}" at factions[${i}]. Must be one of: ${[...FACTION_DEFINITIONS.keys()].join(', ')}.`,
        }];
      }

      // Detect duplicate faction IDs
      if (seenIds.has(override.id)) {
        errors = [...errors, {
          field: `factions[${i}].id`,
          message: `Duplicate faction id "${override.id}" at factions[${i}]. Each faction may only appear once.`,
        }];
      }
      seenIds.add(override.id);

      // Validate power range 0–100
      if (
        typeof override.power !== 'number'
        || !Number.isFinite(override.power)
        || override.power < 0
        || override.power > 100
      ) {
        errors = [...errors, {
          field: `factions[${i}].power`,
          message: `factions[${i}].power must be a number between 0 and 100, got ${override.power}.`,
        }];
      }

      // Validate disposition range -100 to 100
      if (
        typeof override.disposition !== 'number'
        || !Number.isFinite(override.disposition)
        || override.disposition < -100
        || override.disposition > 100
      ) {
        errors = [...errors, {
          field: `factions[${i}].disposition`,
          message: `factions[${i}].disposition must be a number between -100 and 100, got ${override.disposition}.`,
        }];
      }
    }
  }

  // dungeonOgre
  if (fixture.dungeonOgre !== undefined) {
    // Widen to unknown so runtime null/type guards are not flagged as impossible by TypeScript.
    // Callers may supply malformed JSON (null, wrong type) despite the declared type.
    const ogre: unknown = fixture.dungeonOgre;

    // Guard: dungeonOgre must be a non-null object — null and primitives are rejected here
    if (ogre === null || typeof ogre !== 'object') {
      errors = [...errors, {
        field: 'dungeonOgre',
        message: `dungeonOgre must be an object when present, got ${ogre === null ? 'null' : typeof ogre}.`,
      }];
    } else {
      const ogreRaw = ogre as { status?: unknown; emergedAfterRun?: unknown; emergedAtDepth?: unknown };

      // status — required and must be a valid value
      if (!VALID_OGRE_STATUSES.has(ogreRaw.status as 'sealed' | 'emerged' | 'slain')) {
        errors = [...errors, {
          field: 'dungeonOgre.status',
          message: `dungeonOgre.status must be 'sealed', 'emerged', or 'slain', got "${ogreRaw.status}".`,
        }];
      }

      // emergedAfterRun — optional, but must be a finite number when present
      if (ogreRaw.emergedAfterRun !== undefined) {
        if (typeof ogreRaw.emergedAfterRun !== 'number' || !Number.isFinite(ogreRaw.emergedAfterRun)) {
          errors = [...errors, {
            field: 'dungeonOgre.emergedAfterRun',
            message: `dungeonOgre.emergedAfterRun must be a number when present, got ${JSON.stringify(ogreRaw.emergedAfterRun)}.`,
          }];
        }
      }

      // emergedAtDepth — optional, but must be a finite number when present
      if (ogreRaw.emergedAtDepth !== undefined) {
        if (typeof ogreRaw.emergedAtDepth !== 'number' || !Number.isFinite(ogreRaw.emergedAtDepth)) {
          errors = [...errors, {
            field: 'dungeonOgre.emergedAtDepth',
            message: `dungeonOgre.emergedAtDepth must be a number when present, got ${JSON.stringify(ogreRaw.emergedAtDepth)}.`,
          }];
        }
      }
    }
  }

  // town
  if (fixture.town !== undefined) {
    const town = fixture.town;

    if (town.prosperity !== undefined) {
      if (
        typeof town.prosperity !== 'number'
        || !Number.isFinite(town.prosperity)
        || town.prosperity < 0
        || town.prosperity > 100
      ) {
        errors = [...errors, {
          field: 'town.prosperity',
          message: `town.prosperity must be a number between 0 and 100, got ${town.prosperity}.`,
        }];
      }
    }

    if (town.fear !== undefined) {
      if (
        typeof town.fear !== 'number'
        || !Number.isFinite(town.fear)
        || town.fear < 0
        || town.fear > 100
      ) {
        errors = [...errors, {
          field: 'town.fear',
          message: `town.fear must be a number between 0 and 100, got ${town.fear}.`,
        }];
      }
    }

    if (town.corruption !== undefined) {
      if (
        typeof town.corruption !== 'number'
        || !Number.isFinite(town.corruption)
        || town.corruption < 0
        || town.corruption > 100
      ) {
        errors = [...errors, {
          field: 'town.corruption',
          message: `town.corruption must be a number between 0 and 100, got ${town.corruption}.`,
        }];
      }
    }
  }

  // totalRuns
  if (fixture.totalRuns !== undefined) {
    if (
      typeof fixture.totalRuns !== 'number'
      || !Number.isFinite(fixture.totalRuns)
      || fixture.totalRuns < 0
      || !Number.isInteger(fixture.totalRuns)
    ) {
      errors = [...errors, {
        field: 'totalRuns',
        message: `totalRuns must be a non-negative integer, got ${fixture.totalRuns}.`,
      }];
    }
  }

  // deepestFloor
  if (fixture.deepestFloor !== undefined) {
    if (
      typeof fixture.deepestFloor !== 'number'
      || !Number.isFinite(fixture.deepestFloor)
      || fixture.deepestFloor < 0
      || !Number.isInteger(fixture.deepestFloor)
    ) {
      errors = [...errors, {
        field: 'deepestFloor',
        message: `deepestFloor must be a non-negative integer, got ${fixture.deepestFloor}.`,
      }];
    }
  }

  // highestRarityFound
  if (fixture.highestRarityFound !== undefined) {
    if (!VALID_RARITIES.has(fixture.highestRarityFound as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary')) {
      errors = [...errors, {
        field: 'highestRarityFound',
        message: `highestRarityFound must be one of ${[...VALID_RARITIES].join(', ')}, got "${fixture.highestRarityFound}".`,
      }];
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load a WorldFixture into a valid WorldState.
 *
 * Validates the fixture first. Throws a WorldFixtureLoadError if validation fails.
 * Loading is fully deterministic — no randomness is used.
 *
 * The resulting WorldState is indistinguishable from a world that reached the
 * same state through normal gameplay (modulo event history, which is always empty).
 */
export function loadWorldFromFixture(fixture: WorldFixture): WorldState {
  const validation = validateWorldFixture(fixture);
  if (validation.isValid === false) {
    const messages = validation.errors.map(e => `  [${e.field}] ${e.message}`).join('\n');
    throw new WorldFixtureLoadError(
      `Invalid world fixture — ${validation.errors.length} error(s):\n${messages}`,
      validation.errors,
    );
  }

  return buildWorld(fixture);
}

/**
 * Error thrown when a fixture fails validation during loading.
 */
export class WorldFixtureLoadError extends Error {
  readonly validationErrors: readonly WorldFixtureValidationError[];

  constructor(message: string, validationErrors: readonly WorldFixtureValidationError[]) {
    super(message);
    this.name = 'WorldFixtureLoadError';
    this.validationErrors = validationErrors;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal construction helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a WorldState from a validated fixture. */
function buildWorld(fixture: WorldFixture): WorldState {
  return {
    town: buildTown(fixture),
    npcs: [],
    shop: { items: [], buybackMultiplier: ECONOMY.buybackRate },
    eventHistory: [],
    totalRuns: fixture.totalRuns ?? 0,
    deepestFloor: fixture.deepestFloor ?? 0,
    factions: buildFactions(fixture),
    dungeonOgre: buildDungeonOgre(fixture),
    unlockedBlueprints: [],
    highestRarityFound: fixture.highestRarityFound ?? 'common',
  };
}

/** Build the TownState from fixture, applying defaults for omitted fields. */
function buildTown(fixture: WorldFixture): WorldState['town'] {
  const overrides = fixture.town;
  return {
    prosperity: overrides?.prosperity ?? 50,
    fear: overrides?.fear ?? 10,
    corruption: overrides?.corruption ?? 0,
    rumors: [],
    lastRunSummary: null,
  };
}

/**
 * Build the FactionState array.
 *
 * Strategy:
 * 1. Start from INITIAL_FACTIONS (one entry per faction in content).
 * 2. For each faction in fixture.factions, merge the override into the
 *    matching initial entry (power + disposition), keeping all other
 *    fields at their initial values.
 * 3. Factions not listed in fixture.factions retain INITIAL_FACTIONS values.
 */
function buildFactions(fixture: WorldFixture): readonly FactionState[] {
  // Build override lookup keyed by faction id
  const overrideMap = new Map<string, { power: number; disposition: number }>();
  if (fixture.factions !== undefined) {
    for (const override of fixture.factions) {
      overrideMap.set(override.id, { power: override.power, disposition: override.disposition });
    }
  }

  return INITIAL_FACTIONS.map((initial): FactionState => {
    const override = overrideMap.get(initial.id);
    if (override === undefined) {
      return initial;
    }
    return {
      ...initial,
      power: override.power,
      disposition: override.disposition,
    };
  });
}

/** Build the DungeonOgreState from fixture, defaulting to sealed. */
function buildDungeonOgre(fixture: WorldFixture): DungeonOgreState {
  const ogre = fixture.dungeonOgre;
  if (ogre === undefined) {
    return { ...INITIAL_DUNGEON_OGRE };
  }

  return {
    id: 'dungeon_ogre',
    status: ogre.status,
    ...(ogre.emergedAfterRun !== undefined ? { emergedAfterRun: ogre.emergedAfterRun } : {}),
    ...(ogre.emergedAtDepth !== undefined ? { emergedAtDepth: ogre.emergedAtDepth } : {}),
  };
}
