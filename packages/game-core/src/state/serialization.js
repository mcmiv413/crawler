import { CURRENT_SCHEMA_VERSION, validateSchemaVersion, EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import { BASE_PLAYER_STATS } from '@dungeon/content';
/**
 * Converts a StoredFloor (with Maps) to a plain-object representation for JSON.
 */
function serializeStoredFloor(sf) {
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
function deserializeStoredFloor(raw) {
    return {
        floor: {
            ...raw.floor,
            cells: new Map(Object.entries(raw.floor.cells)),
        },
        enemies: new Map(Object.entries(raw.enemies)),
        objects: new Map(Object.entries(raw.objects)),
        playerPosition: raw.playerPosition,
        originalEnemyCount: raw.originalEnemyCount,
        lastSimulatedTurn: raw.lastSimulatedTurn,
    };
}
/**
 * Serialize a GameState to a JSON string, converting all Maps to plain objects.
 * Includes schemaVersion to support future migrations and version mismatch detection.
 */
export function serializeState(state) {
    const serializable = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        ...state,
        run: state.run !== null ? serializeRun(state.run) : null,
        itemRegistry: {
            items: Object.fromEntries(state.itemRegistry.items),
        },
        persistedFloorCache: state.persistedFloorCache !== undefined
            ? Object.fromEntries(Array.from(state.persistedFloorCache.entries()).map(([depth, sf]) => [
                depth,
                serializeStoredFloor(sf),
            ]))
            : undefined,
    };
    return JSON.stringify(serializable);
}
function serializeRun(run) {
    return {
        ...run,
        floor: {
            ...run.floor,
            cells: Object.fromEntries(run.floor.cells),
        },
        enemies: Object.fromEntries(run.enemies),
        objects: Object.fromEntries(run.objects),
        floorHistory: run.floorHistory.map(serializeStoredFloor),
        floorCache: run.floorCache !== undefined
            ? Object.fromEntries(Array.from(run.floorCache.entries()).map(([depth, sf]) => [
                depth,
                serializeStoredFloor(sf),
            ]))
            : undefined,
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
export function deserializeState(json) {
    // Validate schema version before attempting to deserialize
    const { parsed } = validateSchemaVersion(json);
    // Apply defensive defaults for world state fields that may be missing in old saves
    const world = {
        shop: { items: [], buybackMultiplier: 0.5 },
        factions: [],
        ...parsed.world,
    };
    // Apply defensive defaults for player stats in case old saves are missing fields
    const playerObj = parsed.player;
    const playerStats = {
        ...BASE_PLAYER_STATS,
        ...(playerObj.stats ?? {}),
    };
    const player = {
        ...playerObj,
        stats: playerStats,
    };
    // Apply defensive defaults for weaponMastery in case old saves don't have it
    const weaponMastery = {
        ...EMPTY_WEAPON_MASTERY,
        ...(parsed.weaponMastery ?? {}),
    };
    const persistedFloorCache = (parsed.persistedFloorCache !== null && parsed.persistedFloorCache !== undefined)
        ? new Map(Object.entries(parsed.persistedFloorCache).map(([depth, sf]) => [
            Number(depth),
            deserializeStoredFloor(sf),
        ]))
        : undefined;
    const runObj = parsed.run;
    const itemRegistryObj = parsed.itemRegistry;
    return {
        ...parsed,
        world,
        player,
        weaponMastery,
        run: runObj !== null ? deserializeRun(runObj) : null,
        itemRegistry: {
            items: new Map(Object.entries(itemRegistryObj.items)),
        },
        persistedFloorCache,
    };
}
function deserializeRun(raw) {
    return {
        ...raw,
        floor: {
            ...raw.floor,
            cells: new Map(Object.entries(raw.floor.cells)),
        },
        enemies: new Map(Object.entries(raw.enemies)),
        objects: new Map(Object.entries(raw.objects)),
        floorHistory: raw.floorHistory.map(deserializeStoredFloor),
        floorCache: raw.floorCache !== null && raw.floorCache !== undefined
            ? new Map(Object.entries(raw.floorCache).map(([depth, sf]) => [
                Number(depth),
                deserializeStoredFloor(sf),
            ]))
            : undefined,
    };
}
//# sourceMappingURL=serialization.js.map