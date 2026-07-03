import type {
  AnyItemTemplate,
  DungeonFloor,
  EnemyInstance,
  EntityId,
  GameState,
  MapCell,
  ObjectInstance,
  RunState,
  SaveSnapshotStoredFloor,
  SerializedDungeonFloor,
  StoredFloor,
} from '@dungeon/contracts';
import { CURRENT_SCHEMA_VERSION, validateSchemaVersion, EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import { BASE_PLAYER_STATS, MAGIC } from '@dungeon/content';
import { recalculateMagicMana } from '../systems/magic-xp.js';

/** Plain-object (JSON) form of a StoredFloor (Maps become Records). */
type StoredFloorJson = SaveSnapshotStoredFloor;

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
export function serializeStoredFloor(sf: StoredFloor): SaveSnapshotStoredFloor {
  return {
    floor: serializeDungeonFloor(sf.floor),
    enemies: mapToSortedRecord(sf.enemies, cloneJson),
    objects: mapToSortedRecord(sf.objects, cloneJson),
    playerPosition: cloneJson(sf.playerPosition),
    ...(sf.originalEnemyCount !== undefined ? { originalEnemyCount: sf.originalEnemyCount } : {}),
    ...(sf.lastSimulatedTurn !== undefined ? { lastSimulatedTurn: sf.lastSimulatedTurn } : {}),
  };
}

/**
 * Reconstructs a StoredFloor from its plain-object JSON representation.
 */
export function deserializeStoredFloor(raw: StoredFloorJson): StoredFloor {
  return {
    floor: deserializeDungeonFloor(raw.floor),
    enemies: new Map(Object.entries(raw.enemies).map(([k, v]) => [k, cloneJson(v)])) as ReadonlyMap<string, EnemyInstance>,
    objects: new Map(Object.entries(raw.objects).map(([k, v]) => [k, cloneJson(v)])) as ReadonlyMap<string, ObjectInstance>,
    playerPosition: cloneJson(raw.playerPosition),
    ...(raw.originalEnemyCount !== undefined ? { originalEnemyCount: raw.originalEnemyCount } : {}),
    ...(raw.lastSimulatedTurn !== undefined ? { lastSimulatedTurn: raw.lastSimulatedTurn } : {}),
  };
}

export function serializeDungeonFloor(floor: DungeonFloor): SerializedDungeonFloor {
  return {
    width: floor.width,
    height: floor.height,
    depth: floor.depth,
    biomeId: floor.biomeId,
    cells: mapToSortedRecord(floor.cells, cloneJson),
    entrance: cloneJson(floor.entrance),
    exit: cloneJson(floor.exit),
    seed: floor.seed,
  };
}

export function deserializeDungeonFloor(floor: SerializedDungeonFloor): DungeonFloor {
  const { cells, ...rest } = floor;
  return {
    ...cloneJson(rest),
    cells: new Map(Object.entries(cells).map(([k, v]) => [k, cloneJson(v)])) as ReadonlyMap<string, MapCell>,
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
    knownRingSchools: playerObj.knownRingSchools ?? [],
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
    enemies: new Map(Object.entries(raw.enemies).map(([k, v]) => [k, cloneJson(v)])) as ReadonlyMap<string, EnemyInstance>,
    objects: new Map(Object.entries(raw.objects).map(([k, v]) => [k, cloneJson(v)])) as ReadonlyMap<string, ObjectInstance>,
  } as unknown as RunState;
}

export function mapToSortedRecord<T, U>(
  map: ReadonlyMap<string | number, T>,
  convert: (value: T) => U,
): Record<string, U> {
  const mutableEntries = [...map.entries()];
  return Object.fromEntries(
    mutableEntries
      .sort(([left], [right]) => {
        const l = String(left);
        const r = String(right);
        return l < r ? -1 : l > r ? 1 : 0;
      })
      .map(([key, value]) => [String(key), convert(value)]),
  );
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
