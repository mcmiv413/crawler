import type { GameState, StoredFloor, RunState, EntityId, AnyItemTemplate, MapCell, EnemyInstance, DungeonFloor, ObjectInstance } from '@dungeon/contracts';
import { CURRENT_SCHEMA_VERSION, validateSchemaVersion, EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import { BASE_PLAYER_STATS, MAGIC } from '@dungeon/content';
import { recalculateMagicMana } from '../systems/magic-xp.js';

/** Plain-object (JSON) form of a StoredFloor (Maps become Record). */
interface StoredFloorJson {
  floor: Record<string, unknown> & { cells: Record<string, unknown> };
  enemies: Record<string, unknown>;
  objects: Record<string, unknown>;
  playerPosition: StoredFloor['playerPosition'];
  originalEnemyCount?: number;
  lastSimulatedTurn?: number;
}

/** Plain-object (JSON) form of a RunState (Maps become Records). */
interface RunStateJson {
  floor: Record<string, unknown> & { cells: Record<string, unknown> };
  enemies: Record<string, unknown>;
  objects: Record<string, unknown>;
  floorHistory?: StoredFloorJson[] | null;
  floorCache?: Record<string, StoredFloorJson> | null;
  [key: string]: unknown;
}

/**
 * Converts a StoredFloor (with Maps) to a plain-object representation for JSON.
 */
function serializeStoredFloor(sf: StoredFloor): unknown {
  return {
    floor: {
      ...sf.floor,
      cells: Object.fromEntries(sf.floor.cells),
    },
    enemies: Object.fromEntries(sf.enemies),
    objects: Object.fromEntries(sf.objects),
    playerPosition: sf.playerPosition,
    originalEnemyCount: sf.originalEnemyCount,
    lastSimulatedTurn: sf.lastSimulatedTurn,
  };
}

/**
 * Reconstructs a StoredFloor from its plain-object JSON representation.
 */
function deserializeStoredFloor(raw: StoredFloorJson): StoredFloor {
  return {
    floor: {
      ...raw.floor,
      cells: new Map(Object.entries(raw.floor.cells)) as ReadonlyMap<string, MapCell>,
    } as DungeonFloor,
    enemies: new Map(Object.entries(raw.enemies)) as ReadonlyMap<string, EnemyInstance>,
    objects: new Map(Object.entries(raw.objects)) as ReadonlyMap<string, ObjectInstance>,
    playerPosition: raw.playerPosition,
    originalEnemyCount: raw.originalEnemyCount,
    lastSimulatedTurn: raw.lastSimulatedTurn,
  };
}

/**
 * Serialize a GameState to a JSON string, converting all Maps to plain objects.
 * Includes schemaVersion to support future migrations and version mismatch detection.
 */
export function serializeState(state: GameState): string {
  const serializable = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...state,
    run: state.run !== null ? serializeRun(state.run) : null,
    itemRegistry: {
      items: Object.fromEntries(state.itemRegistry.items),
    },
    persistedFloorCache: state.persistedFloorCache !== undefined
      ? Object.fromEntries(
          Array.from(state.persistedFloorCache.entries()).map(([depth, sf]) => [
            depth,
            serializeStoredFloor(sf),
          ]),
        )
      : undefined,
  };
  return JSON.stringify(serializable);
}

function serializeRun(run: RunState): unknown {
  const {
    floorHistory: _legacyFloorHistory,
    floorCache: _legacyFloorCache,
    ...runWithoutLegacyCaches
  } = run;

  return {
    ...runWithoutLegacyCaches,
    floor: {
      ...run.floor,
      cells: Object.fromEntries(run.floor.cells),
    },
    enemies: Object.fromEntries(run.enemies),
    objects: Object.fromEntries(run.objects),
  };
}

/**
 * Deserialize a JSON string back into a GameState, reconstructing all Maps.
 * Validates schema version before deserialization.
 * Applies defensive defaults for fields that may be missing in old saves.
 *
 * @throws SchemaVersionMismatchError if save file version doesn't match current schema
 * @throws SchemaParseError if JSON is malformed or missing required fields
 */
export function deserializeState(json: string): GameState {
  // Validate schema version before attempting to deserialize
  const { parsed } = validateSchemaVersion(json);
  const migratedParsed = migrateLegacyFloorCaches(parsed);

  // Apply defensive defaults for world state fields that may be missing in old saves
  const world = {
    shop: { items: [], buybackMultiplier: 0.5 },
    factions: [],
    ...(migratedParsed.world as Record<string, unknown>),
  };

  // Apply defensive defaults for player stats in case old saves are missing fields
  const playerObj = migratedParsed.player as Record<string, unknown>;
  const playerStats = {
    ...BASE_PLAYER_STATS,
    ...((playerObj.stats ?? {}) as Record<string, unknown>),
  };

  const player = recalculateMagicMana({
    ...playerObj,
    mana: playerObj.mana ?? MAGIC.initialMana,
    maxMana: playerObj.maxMana ?? MAGIC.initialMana,
    ringMastery: playerObj.ringMastery ?? {},
    learnedRingSpellIds: playerObj.learnedRingSpellIds ?? [],
    stats: playerStats,
  } as GameState['player']);

  // Apply defensive defaults for weaponMastery in case old saves don't have it
  const weaponMastery = {
    ...EMPTY_WEAPON_MASTERY,
    ...((migratedParsed.weaponMastery ?? {}) as Record<string, unknown>),
  };

  const persistedFloorCache = (migratedParsed.persistedFloorCache !== null && migratedParsed.persistedFloorCache !== undefined)
    ? new Map(
        Object.entries(migratedParsed.persistedFloorCache as Record<string, StoredFloorJson>).map(
          ([depth, sf]: [string, StoredFloorJson]) => [
            Number(depth),
            deserializeStoredFloor(sf),
          ],
        ),
      ) as ReadonlyMap<number, StoredFloor>
    : undefined;

  const runObj = migratedParsed.run as (RunStateJson | null);
  const itemRegistryObj = migratedParsed.itemRegistry as { items: Record<string, unknown> };

  return {
    ...migratedParsed,
    world,
    player,
    weaponMastery,
    run: runObj !== null ? deserializeRun(runObj) : null,
    itemRegistry: {
      items: new Map(Object.entries(itemRegistryObj.items)) as unknown as ReadonlyMap<EntityId, AnyItemTemplate>,
    },
    persistedFloorCache,
  } as unknown as GameState;
}

function migrateLegacyFloorCaches(parsed: Record<string, unknown>): Record<string, unknown> {
  const runObj = parsed.run as RunStateJson | null | undefined;
  if (runObj === null || runObj === undefined) {
    return parsed;
  }

  const mergedPersistedFloorCache = {
    ...((parsed.persistedFloorCache ?? {}) as Record<string, StoredFloorJson>),
  };

  for (const floor of runObj.floorHistory ?? []) {
    const depth = parseLegacyFloorDepth(floor.floor['depth']);
    if (depth === null) {
      warnSkippedLegacyFloor('run.floorHistory', floor.floor['depth']);
      continue;
    }
    mergedPersistedFloorCache[String(depth)] = withMigratedFloorDepth(floor, depth);
  }

  if (runObj.floorCache !== null && runObj.floorCache !== undefined) {
    for (const [cacheDepth, floor] of Object.entries(runObj.floorCache)) {
      const floorDepth = parseLegacyFloorDepth(floor.floor['depth']);
      if (floorDepth === null) {
        warnSkippedLegacyFloor(`run.floorCache[${cacheDepth}]`, floor.floor['depth']);
        continue;
      }

      const parsedCacheDepth = parseLegacyFloorDepth(cacheDepth);
      if (parsedCacheDepth !== null && parsedCacheDepth !== floorDepth) {
        // eslint-disable-next-line no-console
        console.warn(
          `Skipping legacy floor cache entry during migration: run.floorCache[${cacheDepth}] has floor depth ${String(floor.floor['depth'])}.`,
        );
        continue;
      }

      mergedPersistedFloorCache[String(floorDepth)] = withMigratedFloorDepth(floor, floorDepth);
    }
  }

  const {
    floorHistory: _legacyFloorHistory,
    floorCache: _legacyFloorCache,
    ...runWithoutLegacyCaches
  } = runObj;

  return {
    ...parsed,
    run: runWithoutLegacyCaches,
    persistedFloorCache: Object.keys(mergedPersistedFloorCache).length > 0
      ? mergedPersistedFloorCache
      : parsed.persistedFloorCache,
  };
}

function parseLegacyFloorDepth(depth: unknown): number | null {
  const numericDepth = typeof depth === 'string' && depth.trim().length > 0
    ? Number(depth)
    : depth;
  return typeof numericDepth === 'number'
    && Number.isFinite(numericDepth)
    && Number.isInteger(numericDepth)
    ? numericDepth
    : null;
}

function withMigratedFloorDepth(floor: StoredFloorJson, depth: number): StoredFloorJson {
  return {
    ...floor,
    floor: {
      ...floor.floor,
      depth,
    },
  };
}

function warnSkippedLegacyFloor(source: string, depth: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(
    `Skipping legacy floor cache entry during migration: ${source} has non-migratable depth ${String(depth)}.`,
  );
}

function deserializeRun(raw: RunStateJson): RunState {
  const {
    floorHistory: _legacyFloorHistory,
    floorCache: _legacyFloorCache,
    ...runWithoutLegacyCaches
  } = raw;

  return {
    ...runWithoutLegacyCaches,
    floor: {
      ...raw.floor,
      cells: new Map(Object.entries(raw.floor.cells)) as ReadonlyMap<string, MapCell>,
    },
    enemies: new Map(Object.entries(raw.enemies)) as ReadonlyMap<string, EnemyInstance>,
    objects: new Map(Object.entries(raw.objects)) as ReadonlyMap<string, ObjectInstance>,
  } as unknown as RunState;
}
