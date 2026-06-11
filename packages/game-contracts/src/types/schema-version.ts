/**
 * Schema versioning for GameState serialization.
 *
 * This file defines version constants and types for the serialized game state format.
 * When the GameState structure changes (fields added/renamed/removed), increment
 * CURRENT_SCHEMA_VERSION and add a migration function.
 *
 * Version history:
 * - v1: Initial schema (until 2026-05-01)
 *   Includes: player, world, run, itemRegistry, phase, activeQuests
 * - v2: Faction system hardening (2026-05-01)
 *   Adds: Faction leader/Ogre validation; explicit schema validation for world.factions and world.dungeonOgre
 * - v3: Magic ring system (2026-05-10)
 *   Adds: player mana, maxMana, and ringMastery state
 * - v4: Ring magic generalization (2026-05-11)
 *   Changes: ringMastery shape from Record<'fire', {xp, spellsUnlocked}> to Record<school, {xp}>; spellsUnlocked removed (use learnedRingSpellIds)
 * - v5: Canonical floor persistence (2026-06-11)
 *   Changes: run.floorHistory and run.floorCache are migrated into persistedFloorCache
 */

/**
 * Current schema version for serialized GameState.
 * Increment when the serialized format structure changes materially.
 */
export const CURRENT_SCHEMA_VERSION = 5;

/**
 * Type for a serialized game state with explicit schema version.
 * This is what gets persisted to JSON (server DB or browser storage).
 */
export interface SerializedGameState {
  readonly schemaVersion: number;
  readonly [key: string]: unknown; // Rest of state structure
}

/**
 * Get a user-friendly message for an incompatible schema version.
 */
export function getSchemaVersionErrorMessage(foundVersion: number): string {
  if (foundVersion < CURRENT_SCHEMA_VERSION) {
    return `Your saved game is from an older version of the game. Please start a new run.`;
  }
  if (foundVersion > CURRENT_SCHEMA_VERSION) {
    return `Your saved game is from a newer version of the game. Please update the game client.`;
  }
  return `Invalid schema version: ${foundVersion}`;
}
