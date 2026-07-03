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
import {
  isFiniteNumber,
  isNonNegativeInteger,
  validateContentRef,
  validateNumberInRange,
} from '../state/validation-guards.js';
import { BaseFixtureLoadError, formatValidationErrors } from './fixture-validation.js';

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
  const mutableErrors: WorldFixtureValidationError[] = [];

  // schemaVersion
  if (fixture.schemaVersion !== WORLD_FIXTURE_SCHEMA_VERSION) {
    mutableErrors.push({
      field: 'schemaVersion',
      message: `Unsupported world fixture schemaVersion ${fixture.schemaVersion}. Expected ${WORLD_FIXTURE_SCHEMA_VERSION}.`,
    });
  }

  // factions
  if (fixture.factions !== undefined) {
    const seenIds = new Set<string>();
    for (let i = 0; i < fixture.factions.length; i++) {
      const override = fixture.factions[i]!;

      // Validate faction ID exists in content
      mutableErrors.push(...validateContentRef<string, WorldFixtureValidationError>(
        `factions[${i}].id`,
        override.id,
        FACTION_DEFINITIONS,
        'FACTION_DEFINITIONS',
        value => `Unknown faction id "${String(value)}" at factions[${i}]. Must be one of: ${[...FACTION_DEFINITIONS.keys()].join(', ')}.`,
      ));

      // Detect duplicate faction IDs
      if (seenIds.has(override.id)) {
        mutableErrors.push({
          field: `factions[${i}].id`,
          message: `Duplicate faction id "${override.id}" at factions[${i}]. Each faction may only appear once.`,
        });
      }
      seenIds.add(override.id);

      mutableErrors.push(
        ...validateFixtureRange(`factions[${i}].power`, override.power, 0, 100),
        ...validateFixtureRange(`factions[${i}].disposition`, override.disposition, -100, 100),
      );
    }
  }

  // dungeonOgre
  if (fixture.dungeonOgre !== undefined) {
    // Widen to unknown so runtime null/type guards are not flagged as impossible by TypeScript.
    // Callers may supply malformed JSON (null, wrong type) despite the declared type.
    const ogre: unknown = fixture.dungeonOgre;

    // Guard: dungeonOgre must be a non-null object — null and primitives are rejected here
    if (ogre === null || typeof ogre !== 'object') {
      mutableErrors.push({
        field: 'dungeonOgre',
        message: `dungeonOgre must be an object when present, got ${ogre === null ? 'null' : typeof ogre}.`,
      });
    } else {
      const ogreRaw = ogre as { status?: unknown; emergedAfterRun?: unknown; emergedAtDepth?: unknown };

      // status — required and must be a valid value
      if (!VALID_OGRE_STATUSES.has(ogreRaw.status as 'sealed' | 'emerged' | 'slain')) {
        mutableErrors.push({
          field: 'dungeonOgre.status',
          message: `dungeonOgre.status must be 'sealed', 'emerged', or 'slain', got "${ogreRaw.status}".`,
        });
      }

      // emergedAfterRun — optional, but must be a finite number when present
      if (ogreRaw.emergedAfterRun !== undefined) {
        if (!isFiniteNumber(ogreRaw.emergedAfterRun)) {
          mutableErrors.push({
            field: 'dungeonOgre.emergedAfterRun',
            message: `dungeonOgre.emergedAfterRun must be a number when present, got ${JSON.stringify(ogreRaw.emergedAfterRun)}.`,
          });
        }
      }

      // emergedAtDepth — optional, but must be a finite number when present
      if (ogreRaw.emergedAtDepth !== undefined) {
        if (!isFiniteNumber(ogreRaw.emergedAtDepth)) {
          mutableErrors.push({
            field: 'dungeonOgre.emergedAtDepth',
            message: `dungeonOgre.emergedAtDepth must be a number when present, got ${JSON.stringify(ogreRaw.emergedAtDepth)}.`,
          });
        }
      }
    }
  }

  // town
  if (fixture.town !== undefined) {
    const town = fixture.town;
    for (const { field, value } of [
      { field: 'town.prosperity', value: town.prosperity },
      { field: 'town.fear', value: town.fear },
      { field: 'town.corruption', value: town.corruption },
    ] as const) {
      if (value !== undefined) {
        mutableErrors.push(...validateFixtureRange(field, value, 0, 100));
      }
    }
  }

  // totalRuns
  if (fixture.totalRuns !== undefined) {
    if (!isNonNegativeInteger(fixture.totalRuns)) {
      mutableErrors.push({
        field: 'totalRuns',
        message: `totalRuns must be a non-negative integer, got ${fixture.totalRuns}.`,
      });
    }
  }

  // deepestFloor
  if (fixture.deepestFloor !== undefined) {
    if (!isNonNegativeInteger(fixture.deepestFloor)) {
      mutableErrors.push({
        field: 'deepestFloor',
        message: `deepestFloor must be a non-negative integer, got ${fixture.deepestFloor}.`,
      });
    }
  }

  // highestRarityFound
  if (fixture.highestRarityFound !== undefined) {
    if (!VALID_RARITIES.has(fixture.highestRarityFound as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary')) {
      mutableErrors.push({
        field: 'highestRarityFound',
        message: `highestRarityFound must be one of ${[...VALID_RARITIES].join(', ')}, got "${fixture.highestRarityFound}".`,
      });
    }
  }

  return {
    isValid: mutableErrors.length === 0,
    errors: mutableErrors,
  };
}

function validateFixtureRange(
  field: string,
  value: unknown,
  min: number,
  max: number,
): WorldFixtureValidationError[] {
  return validateNumberInRange<WorldFixtureValidationError>(
    field,
    value,
    min,
    max,
    (rangeField, rangeValue, rangeMin, rangeMax) =>
      `${rangeField} must be a number between ${rangeMin} and ${rangeMax}, got ${String(rangeValue)}.`,
  );
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
    throw new WorldFixtureLoadError(
      `Invalid world fixture — ${validation.errors.length} error(s):\n${formatValidationErrors(validation.errors)}`,
      validation.errors,
    );
  }

  return buildWorld(fixture);
}

/**
 * Build a WorldState from a fixture that has already passed validateWorldFixture().
 * Use this only on validation paths that need the resolved world without paying
 * for duplicate validation.
 */
export function loadWorldFromValidatedFixture(fixture: WorldFixture): WorldState {
  return buildWorld(fixture);
}

/**
 * Error thrown when a fixture fails validation during loading.
 */
export class WorldFixtureLoadError extends BaseFixtureLoadError<WorldFixtureValidationError> {
  constructor(message: string, validationErrors: readonly WorldFixtureValidationError[]) {
    super('WorldFixtureLoadError', message, validationErrors);
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
