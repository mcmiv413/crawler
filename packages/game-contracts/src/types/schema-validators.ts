/**
 * Schema validators for serialized GameState.
 *
 * These validators check that loaded save files have the expected structure
 * without enforcing strict type correctness on every nested field.
 * The goal is to catch obviously broken saves and version mismatches early.
 */

import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION } from './schema-version.js';

const MIN_SUPPORTED_SCHEMA_VERSION = 4;

/**
 * Custom error for schema version mismatches.
 * Thrown when a save file has a version that doesn't match the current schema.
 */
export class SchemaVersionMismatchError extends Error {
  constructor(
    public readonly foundVersion: number,
    public readonly expectedVersion: number = CURRENT_SCHEMA_VERSION,
  ) {
    super(
      `Schema version mismatch: found v${foundVersion}, expected v${expectedVersion}. ` +
        `Save file may be from a different game version.`,
    );
    this.name = 'SchemaVersionMismatchError';
  }
}

/**
 * Custom error for parse failures.
 */
export class SchemaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaParseError';
  }
}

/**
 * Minimal schema for validating the structure of a serialized GameState.
 * This validates only the top-level shape, not deeply nested fields.
 * The actual deserialization will reconstruct Maps and handle field defaults.
 */
const MinimalGameStateSchema = z.object({
  schemaVersion: z.number().int().positive(),
  // Presence check only; actual structure is validated by deserialization
  player: z.object({
    name: z.string(),
  }).passthrough(),
  world: z.object({}).passthrough(),
  run: z.object({}).passthrough().nullable(),
  itemRegistry: z.object({}).passthrough(),
  phase: z.string(),
  activeQuests: z.array(z.object({}).passthrough()),
});

/**
 * Validates that JSON contains a schemaVersion field and can be parsed structurally.
 * Does NOT validate the entire GameState deeply; that's done by deserializeState.
 *
 * Returns the parsed schemaVersion and the raw parsed object.
 *
 * @throws SchemaVersionMismatchError if schemaVersion is present but incompatible
 * @throws SchemaParseError if JSON is malformed or missing required fields
 */
export function validateSchemaVersion(jsonString: string): {
  schemaVersion: number;
  parsed: Record<string, unknown>;
} {
  let parsed: unknown;

  // Step 1: Parse JSON
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new SchemaParseError(
      `Failed to parse save file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // Step 2: Ensure parsed is an object
  if (typeof parsed !== 'object' || parsed === null) {
    throw new SchemaParseError(`Save file must be a JSON object, got ${typeof parsed}`);
  }

  const obj = parsed as Record<string, unknown>;

  // Step 3: Check for schemaVersion field
  if (!('schemaVersion' in obj)) {
    // No version field: this is an old (v0) format save
    // For backward compatibility, treat as v0 and let deserialize handle it
    return {
      schemaVersion: 0,
      parsed: obj,
    };
  }

  // Step 4: Validate schemaVersion is a number
  const { schemaVersion } = obj;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    throw new SchemaParseError(
      `schemaVersion must be an integer, got ${typeof schemaVersion}: ${schemaVersion}`,
    );
  }

  // Step 5: Check version compatibility
  if (schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION || schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new SchemaVersionMismatchError(schemaVersion, CURRENT_SCHEMA_VERSION);
  }

  // Step 6: Validate minimal structure (non-strict)
  try {
    MinimalGameStateSchema.parse(obj);
  } catch (error) {
    throw new SchemaParseError(
      `Save file structure validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  return {
    schemaVersion,
    parsed: obj,
  };
}
