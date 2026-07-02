/**
 * Scenario Fixture Validation — Phase 2
 *
 * Pure validation for scenario fixtures plus reference resolution. Reuses the
 * existing player/world fixture validators rather than re-implementing their
 * rules, and never adds scenario-specific exceptions to runtime systems.
 */

import type { FactionState, Position, WorldState } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';
import {
  ENEMY_TEMPLATES,
  ITEM_BY_ID,
  OBJECT_TEMPLATES,
  STATUS_DEFINITIONS,
} from '@dungeon/content';

import { validatePlayerFixture } from './player-fixture-loader.js';
import { loadWorldFromValidatedFixture, validateWorldFixture } from './world-fixture-loader.js';
import { createEnemyInstance } from '../generation/enemy-instantiation.js';
import type {
  ScenarioFixture,
  ScenarioResolvers,
  ScenarioValidationError,
  ScenarioValidationResult,
} from './scenario-fixture-types.js';
import type { PlayerFixture } from './player-fixture-types.js';
import type { WorldFixture } from './world-fixture-types.js';

/** Current supported scenario fixture schema version. */
export const SCENARIO_FIXTURE_SCHEMA_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Reference resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the player fixture for a scenario, preferring an inline fixture and
 * falling back to a named reference via the supplied resolvers.
 * Returns null when the reference cannot be resolved.
 */
// ─────────────────────────────────────────────────────────────────────────────
// Runtime shape guards (scenario fixtures arrive as untrusted JSON)
// ─────────────────────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositionLike(value: unknown): value is Position {
  return isObject(value) && typeof value.x === 'number' && typeof value.y === 'number';
}

function isSpawnLike(value: unknown): value is { readonly name: string; readonly position: Position } {
  return isObject(value) && typeof value.name === 'string' && isPositionLike(value.position);
}

export function resolveScenarioPlayer(
  scenario: ScenarioFixture,
  resolvers: ScenarioResolvers | undefined,
): { fixture: PlayerFixture | null; error?: string } {
  // Untrusted JSON: player may be missing or a non-object at runtime.
  const player = scenario.player as unknown;
  if (!isObject(player)) {
    return { fixture: null, error: 'player must be an object specifying either inline or ref.' };
  }
  if (player.inline !== undefined) {
    // Untrusted JSON: inline may be null or a primitive; guard so downstream
    // validatePlayerFixture never receives a non-object and crashes.
    if (!isObject(player.inline)) {
      return { fixture: null, error: 'player.inline must be an object fixture.' };
    }
    return { fixture: player.inline as unknown as PlayerFixture };
  }
  if (player.ref !== undefined) {
    // Untrusted JSON: ref may be a number/object; validate before resolving so
    // the resolver only ever sees a real reference string.
    if (typeof player.ref !== 'string' || player.ref.length === 0) {
      return { fixture: null, error: `player.ref must be a non-empty string, got ${JSON.stringify(player.ref)}.` };
    }
    const ref = player.ref;
    if (resolvers === undefined) {
      return { fixture: null, error: `player.ref "${ref}" requires resolvers but none were supplied.` };
    }
    try {
      const resolved = resolvers.resolvePlayerFixture(ref) as unknown;
      if (!isObject(resolved)) {
        return { fixture: null, error: `player.ref "${ref}" resolved to a non-object fixture.` };
      }
      return { fixture: resolved as unknown as PlayerFixture };
    } catch (err) {
      return { fixture: null, error: `Unknown player fixture reference "${ref}": ${(err as Error).message}` };
    }
  }
  return { fixture: null, error: 'player must specify either inline or ref.' };
}

export function resolveScenarioWorld(
  scenario: ScenarioFixture,
  resolvers: ScenarioResolvers | undefined,
): { fixture: WorldFixture | null; error?: string } {
  // Untrusted JSON: world may be missing or a non-object at runtime.
  const world = scenario.world as unknown;
  if (!isObject(world)) {
    return { fixture: null, error: 'world must be an object specifying either inline or ref.' };
  }
  if (world.inline !== undefined) {
    // Untrusted JSON: inline may be null or a primitive; guard so downstream
    // validateWorldFixture never receives a non-object and crashes.
    if (!isObject(world.inline)) {
      return { fixture: null, error: 'world.inline must be an object fixture.' };
    }
    return { fixture: world.inline as unknown as WorldFixture };
  }
  if (world.ref !== undefined) {
    // Untrusted JSON: ref may be a number/object; validate before resolving so
    // the resolver only ever sees a real reference string.
    if (typeof world.ref !== 'string' || world.ref.length === 0) {
      return { fixture: null, error: `world.ref must be a non-empty string, got ${JSON.stringify(world.ref)}.` };
    }
    const ref = world.ref;
    if (resolvers === undefined) {
      return { fixture: null, error: `world.ref "${ref}" requires resolvers but none were supplied.` };
    }
    try {
      const resolved = resolvers.resolveWorldFixture(ref) as unknown;
      if (!isObject(resolved)) {
        return { fixture: null, error: `world.ref "${ref}" resolved to a non-object fixture.` };
      }
      return { fixture: resolved as unknown as WorldFixture };
    } catch (err) {
      return { fixture: null, error: `Unknown world fixture reference "${ref}": ${(err as Error).message}` };
    }
  }
  return { fixture: null, error: 'world must specify either inline or ref.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a ScenarioFixture for structural and content-reference correctness.
 *
 * Reuses validatePlayerFixture and validateWorldFixture for the composed
 * fixtures rather than re-implementing their rules. Never silently succeeds.
 */
export function validateScenarioFixture(
  scenario: ScenarioFixture,
  resolvers?: ScenarioResolvers,
): ScenarioValidationResult {
  const metaErrors = validateMeta(scenario);
  const { world, errors: composedErrors } = validateComposedFixtures(scenario, resolvers);
  const placementErrors = validateMapAndPlacements(scenario, resolveWorldFactions(world));
  const errors = [...metaErrors, ...composedErrors, ...placementErrors];
  return { isValid: errors.length === 0, errors };
}

function validateMeta(scenario: ScenarioFixture): ScenarioValidationError[] {
  return [
    ...(scenario.schemaVersion !== SCENARIO_FIXTURE_SCHEMA_VERSION
      ? [{ field: 'schemaVersion', message: `Unsupported scenario schemaVersion ${scenario.schemaVersion}. Expected ${SCENARIO_FIXTURE_SCHEMA_VERSION}.` }]
      : []),
    ...(typeof scenario.name !== 'string' || scenario.name.trim().length === 0
      ? [{ field: 'name', message: 'name must be a non-empty string.' }]
      : []),
    ...(scenario.floor !== undefined && (!Number.isInteger(scenario.floor) || scenario.floor < 1)
      ? [{ field: 'floor', message: `floor must be an integer ≥ 1, got ${scenario.floor}.` }]
      : []),
    ...(scenario.seed !== undefined && (!Number.isFinite(scenario.seed) || !Number.isInteger(scenario.seed))
      ? [{ field: 'seed', message: `seed must be an integer, got ${scenario.seed}.` }]
      : []),
  ];
}

function resolveValidatedWorld(
  worldResolution: { fixture: WorldFixture | null; error?: string },
): { world: WorldState | null; errors: ScenarioValidationError[] } {
  if (worldResolution.fixture === null) {
    return {
      world: null,
      errors: [{ field: 'world', message: worldResolution.error ?? 'world fixture could not be resolved.' }],
    };
  }
  const worldValidation = validateWorldFixture(worldResolution.fixture);
  if (worldValidation.isValid === false) {
    return {
      world: null,
      errors: worldValidation.errors.map(e => ({ field: `world.${e.field}`, message: e.message })),
    };
  }
  return { world: loadWorldFromValidatedFixture(worldResolution.fixture), errors: [] };
}

function validateComposedFixtures(
  scenario: ScenarioFixture,
  resolvers: ScenarioResolvers | undefined,
): { world: WorldState | null; errors: ScenarioValidationError[] } {
  const playerResolution = resolveScenarioPlayer(scenario, resolvers);
  let playerErrors: ScenarioValidationError[];
  if (playerResolution.fixture === null) {
    playerErrors = [{ field: 'player', message: playerResolution.error ?? 'player fixture could not be resolved.' }];
  } else {
    const playerValidation = validatePlayerFixture(playerResolution.fixture);
    playerErrors = playerValidation.isValid === false
      ? playerValidation.errors.map(e => ({ field: `player.${e.field}`, message: e.message }))
      : [];
  }

  const { world, errors: worldErrors } = resolveValidatedWorld(resolveScenarioWorld(scenario, resolvers));

  return { world, errors: [...playerErrors, ...worldErrors] };
}

function resolveWorldFactions(
  world: WorldState | null,
): readonly FactionState[] {
  return world?.factions ?? [];
}

function validateMapAndPlacements(
  scenario: ScenarioFixture,
  worldFactions: readonly FactionState[],
): ScenarioValidationError[] {
  // Scenario fixtures arrive as untrusted JSON: validate runtime shapes before
  // dereferencing so malformed input produces field errors instead of throwing.
  const map = scenario.map as unknown;
  if (!isObject(map)) {
    return [{ field: 'map', message: 'map is required.' }];
  }

  const widthValid = Number.isInteger(map.width) && (map.width as number) >= 1;
  const heightValid = Number.isInteger(map.height) && (map.height as number) >= 1;
  const dimErrors: ScenarioValidationError[] = [
    ...(widthValid === false ? [{ field: 'map.width', message: `map.width must be an integer ≥ 1, got ${JSON.stringify(map.width)}.` }] : []),
    ...(heightValid === false ? [{ field: 'map.height', message: `map.height must be an integer ≥ 1, got ${JSON.stringify(map.height)}.` }] : []),
  ];
  // Bail out before using width/height: continuing with invalid dimensions
  // produces confusing bounds messages and cascades into placement errors.
  if (widthValid === false || heightValid === false) {
    return dimErrors;
  }
  const width = map.width as number;
  const height = map.height as number;

  const inBounds = (p: Position): boolean =>
    Number.isInteger(p.x) && Number.isInteger(p.y)
    && p.x >= 0 && p.x < width && p.y >= 0 && p.y < height;

  // Normalize array-valued fields: a present-but-non-array field is a shape
  // error; individual malformed entries are reported in their own loop below.
  const rawWalls = map.walls;
  const rawFloors = map.floors;
  const rawSpawns = map.spawns;
  const arrayErrors: ScenarioValidationError[] = [
    ...(rawWalls !== undefined && !Array.isArray(rawWalls) ? [{ field: 'map.walls', message: 'map.walls must be an array of { x, y } coordinates.' }] : []),
    ...(rawFloors !== undefined && !Array.isArray(rawFloors) ? [{ field: 'map.floors', message: 'map.floors must be an array of { x, y } coordinates.' }] : []),
    ...(rawSpawns !== undefined && !Array.isArray(rawSpawns) ? [{ field: 'map.spawns', message: 'map.spawns must be an array of { name, position } objects.' }] : []),
  ];
  const walls: readonly unknown[] = Array.isArray(rawWalls) ? rawWalls : [];
  const floors: readonly unknown[] = Array.isArray(rawFloors) ? rawFloors : [];
  const spawns: readonly unknown[] = Array.isArray(rawSpawns) ? rawSpawns : [];

  const wallSet = new Set<string>(walls.filter(isPositionLike).map(posKey));
  const occupied = new Map<string, string>();

  const playerStart = map.playerStart;
  const playerStartValid = isPositionLike(playerStart) && inBounds(playerStart);

  // When an explicit floor list is provided, only those cells (plus a valid
  // player start and named spawns) are walkable; everything else is a wall.
  // Only an actual array enables explicit-floor mode; a non-array map.floors is
  // a shape error (reported above) and must not silently make every cell a wall.
  const explicitFloors = Array.isArray(rawFloors)
    ? new Set<string>([
        ...floors.filter(isPositionLike).map(posKey),
        ...(playerStartValid === true ? [posKey(playerStart)] : []),
        ...spawns.filter(isSpawnLike).map(s => posKey(s.position)),
      ])
    : null;
  const isWalkable = (p: Position): boolean =>
    !wallSet.has(posKey(p)) && (explicitFloors === null || explicitFloors.has(posKey(p)));

  // playerStart (untrusted JSON: may be missing/malformed at runtime)
  let playerStartErrors: ScenarioValidationError[];
  if (!isPositionLike(playerStart) || !inBounds(playerStart)) {
    playerStartErrors = [{ field: 'map.playerStart', message: `map.playerStart must be an in-bounds coordinate within [0,${width}) × [0,${height}), got ${JSON.stringify(map.playerStart)}.` }];
  } else if (wallSet.has(posKey(playerStart))) {
    playerStartErrors = [{ field: 'map.playerStart', message: `map.playerStart ${posKey(playerStart)} cannot be on a wall.` }];
  } else {
    occupied.set(posKey(playerStart), 'playerStart');
    playerStartErrors = [];
  }

  const wallErrors = walls.flatMap((wall, i) => {
    if (!isPositionLike(wall)) return [{ field: `map.walls[${i}]`, message: `wall coordinate ${JSON.stringify(wall)} must be a { x, y } object.` }];
    if (!inBounds(wall)) return [{ field: `map.walls[${i}]`, message: `wall coordinate ${JSON.stringify(wall)} is out of bounds.` }];
    return [] as ScenarioValidationError[];
  });

  const floorErrors = floors.flatMap((floor, i) => {
    if (!isPositionLike(floor)) return [{ field: `map.floors[${i}]`, message: `floor coordinate ${JSON.stringify(floor)} must be a { x, y } object.` }];
    if (!inBounds(floor)) return [{ field: `map.floors[${i}]`, message: `floor coordinate ${JSON.stringify(floor)} is out of bounds.` }];
    return [] as ScenarioValidationError[];
  });

  const seenNames = new Set<string>();
  const spawnErrors = spawns.flatMap((spawn, i) => {
    if (!isSpawnLike(spawn)) return [{ field: `map.spawns[${i}]`, message: `spawn must be a { name, position } object, got ${JSON.stringify(spawn)}.` }];
    const nameErrors: ScenarioValidationError[] = seenNames.has(spawn.name)
      ? [{ field: `map.spawns[${i}].name`, message: `Duplicate spawn name "${spawn.name}". Spawn names must be unique.` }]
      : [];
    seenNames.add(spawn.name);
    const posErrors: ScenarioValidationError[] = !inBounds(spawn.position)
      ? [{ field: `map.spawns[${i}].position`, message: `spawn "${spawn.name}" position ${JSON.stringify(spawn.position)} is out of bounds.` }]
      : wallSet.has(posKey(spawn.position))
      ? [{ field: `map.spawns[${i}].position`, message: `spawn "${spawn.name}" cannot be placed on a wall.` }]
      : [];
    return [...nameErrors, ...posErrors];
  });

  return [
    ...arrayErrors,
    ...playerStartErrors,
    ...wallErrors,
    ...floorErrors,
    ...spawnErrors,
    ...validateEnemyPlacements(scenario, floorNumber(scenario), worldFactions, inBounds, isWalkable, occupied),
    ...validateLootPlacements(scenario, inBounds, isWalkable, occupied),
    ...validateInteractablePlacements(scenario, inBounds, isWalkable, occupied),
  ];
}

function floorNumber(scenario: ScenarioFixture): number {
  return scenario.floor ?? 1;
}

function validateEnemyPlacements(
  scenario: ScenarioFixture,
  defaultDepth: number,
  worldFactions: readonly FactionState[],
  inBounds: (p: Position) => boolean,
  isWalkable: (p: Position) => boolean,
  occupied: Map<string, string>,
): ScenarioValidationError[] {
  // Scenario fixtures arrive as untrusted JSON: validate runtime shapes before
  // dereferencing so malformed input produces field errors instead of throwing.
  const rawEnemies = scenario.enemies as unknown;
  if (rawEnemies === undefined) return [];
  if (!Array.isArray(rawEnemies)) {
    return [{ field: 'enemies', message: 'enemies must be an array of placement objects.' }];
  }
  return rawEnemies.flatMap((rawPlacement, i) => {
    const field = `enemies[${i}]`;
    const placement = rawPlacement as NonNullable<ScenarioFixture['enemies']>[number];
    if (!isObject(placement)) {
      return [{ field, message: `enemy placement must be a { templateId, position } object, got ${JSON.stringify(rawPlacement)}.` }];
    }

    const templateExists = typeof placement.templateId === 'string' && ENEMY_TEMPLATES.has(placement.templateId);
    const templateIdErrors: ScenarioValidationError[] = typeof placement.templateId !== 'string'
      ? [{ field: `${field}.templateId`, message: `enemy templateId must be a string, got ${JSON.stringify(placement.templateId)}.` }]
      : templateExists === false
      ? [{ field: `${field}.templateId`, message: `Unknown enemy template id "${placement.templateId}". Must exist in ENEMY_TEMPLATES.` }]
      : [];

    const positionValid = isPositionLike(placement.position);
    let positionErrors: ScenarioValidationError[];
    if (positionValid === false) {
      positionErrors = [{ field: `${field}.position`, message: `enemy position must be a { x, y } object, got ${JSON.stringify(placement.position)}.` }];
    } else if (!inBounds(placement.position)) {
      positionErrors = [{ field: `${field}.position`, message: `enemy position ${JSON.stringify(placement.position)} is out of bounds.` }];
    } else {
      const key = posKey(placement.position);
      const walkableError: ScenarioValidationError[] = !isWalkable(placement.position)
        ? [{ field: `${field}.position`, message: `enemy cannot be placed on a non-walkable cell at ${key}.` }]
        : [];
      const existing = occupied.get(key);
      const overlapError: ScenarioValidationError[] = existing !== undefined
        ? [{ field: `${field}.position`, message: `enemy overlaps an existing placement (${existing}) at ${key}.` }]
        : [];
      if (existing === undefined) {
        occupied.set(key, `enemies[${i}]`);
      }
      positionErrors = [...walkableError, ...overlapError];
    }

    const levelErrors: ScenarioValidationError[] = placement.level !== undefined && (!Number.isInteger(placement.level) || placement.level < 1)
      ? [{ field: `${field}.level`, message: `enemy level override must be an integer ≥ 1, got ${placement.level}.` }]
      : [];

    const healthErrors: ScenarioValidationError[] = placement.health !== undefined && (!Number.isFinite(placement.health) || placement.health <= 0)
      ? [{ field: `${field}.health`, message: `enemy health override must be a positive number, got ${placement.health}.` }]
      : [];

    const healthMultiplierErrors: ScenarioValidationError[] = placement.healthMultiplier !== undefined && (!Number.isFinite(placement.healthMultiplier) || placement.healthMultiplier <= 0)
      ? [{ field: `${field}.healthMultiplier`, message: `enemy healthMultiplier must be a positive number, got ${placement.healthMultiplier}.` }]
      : [];

    const statusErrors: ScenarioValidationError[] = placement.statuses !== undefined
      ? !Array.isArray(placement.statuses)
        ? [{ field: `${field}.statuses`, message: `enemy statuses must be an array of status ids, got ${JSON.stringify(placement.statuses)}.` }]
        : placement.statuses.flatMap(statusId =>
            typeof statusId !== 'string' || !STATUS_DEFINITIONS.has(statusId)
              ? [{ field: `${field}.statuses`, message: `Unknown status id ${JSON.stringify(statusId)}. Valid: ${[...STATUS_DEFINITIONS.keys()].join(', ')}.` }]
              : [] as ScenarioValidationError[]
          )
      : [];

    // Health override must not exceed the scaled maxHealth the runtime factory
    // would produce. Compute it with the same factory to avoid duplicating
    // scaling math.
    const levelIsValid = placement.level === undefined || (Number.isInteger(placement.level) && placement.level >= 1);
    const healthMultiplierIsValid = placement.healthMultiplier === undefined
      || (Number.isFinite(placement.healthMultiplier) && placement.healthMultiplier > 0);
    const healthIsValid = placement.health !== undefined && Number.isFinite(placement.health) && placement.health > 0;

    const healthCapErrors: ScenarioValidationError[] = ((): ScenarioValidationError[] => {
      if (templateExists && positionValid && healthIsValid && levelIsValid && healthMultiplierIsValid) {
        const template = ENEMY_TEMPLATES.get(placement.templateId)!;
        const depth = placement.level ?? defaultDepth;
        const scaled = createEnemyInstance(template, { ...placement.position }, depth, {
          id: entityId('scenario_validate_probe'),
          factions: worldFactions,
          ...(placement.healthMultiplier !== undefined ? { enemyHealthMultiplier: placement.healthMultiplier } : {}),
        });
        if (placement.health > scaled.stats.maxHealth) {
          return [{ field: `${field}.health`, message: `enemy health override (${placement.health}) cannot exceed scaled maxHealth (${scaled.stats.maxHealth}).` }];
        }
      }
      return [];
    })();

    return [
      ...templateIdErrors,
      ...positionErrors,
      ...levelErrors,
      ...healthErrors,
      ...healthMultiplierErrors,
      ...statusErrors,
      ...healthCapErrors,
    ];
  });
}

function validateLootPlacements(
  scenario: ScenarioFixture,
  inBounds: (p: Position) => boolean,
  isWalkable: (p: Position) => boolean,
  occupied: Map<string, string>,
): ScenarioValidationError[] {
  // Scenario fixtures arrive as untrusted JSON: validate runtime shapes before
  // dereferencing so malformed input produces field errors instead of throwing.
  const rawLoot = scenario.loot as unknown;
  if (rawLoot === undefined) return [];
  if (!Array.isArray(rawLoot)) {
    return [{ field: 'loot', message: 'loot must be an array of placement objects.' }];
  }
  return rawLoot.flatMap((rawPlacement, i) => {
    const field = `loot[${i}]`;
    const placement = rawPlacement as NonNullable<ScenarioFixture['loot']>[number];
    if (!isObject(placement)) {
      return [{ field, message: `loot placement must be a { itemId, position } object, got ${JSON.stringify(rawPlacement)}.` }];
    }
    const itemIdErrors: ScenarioValidationError[] = typeof placement.itemId !== 'string'
      ? [{ field: `${field}.itemId`, message: `loot itemId must be a string, got ${JSON.stringify(placement.itemId)}.` }]
      : !ITEM_BY_ID.has(placement.itemId)
      ? [{ field: `${field}.itemId`, message: `Unknown item id "${placement.itemId}". Must exist in ITEM_BY_ID.` }]
      : [];

    let positionErrors: ScenarioValidationError[];
    if (!isPositionLike(placement.position)) {
      positionErrors = [{ field: `${field}.position`, message: `loot position must be a { x, y } object, got ${JSON.stringify(placement.position)}.` }];
    } else if (!inBounds(placement.position)) {
      positionErrors = [{ field: `${field}.position`, message: `loot position ${JSON.stringify(placement.position)} is out of bounds.` }];
    } else {
      const key = posKey(placement.position);
      const walkableError: ScenarioValidationError[] = !isWalkable(placement.position)
        ? [{ field: `${field}.position`, message: `loot cannot be placed on a non-walkable cell at ${key}.` }]
        : [];
      const existing = occupied.get(key);
      const overlapError: ScenarioValidationError[] = existing !== undefined
        ? [{ field: `${field}.position`, message: `loot overlaps an existing placement (${existing}) at ${key}.` }]
        : [];
      if (existing === undefined) {
        occupied.set(key, `loot[${i}]`);
      }
      positionErrors = [...walkableError, ...overlapError];
    }

    return [...itemIdErrors, ...positionErrors];
  });
}

function validateInteractablePlacements(
  scenario: ScenarioFixture,
  inBounds: (p: Position) => boolean,
  isWalkable: (p: Position) => boolean,
  occupied: Map<string, string>,
): ScenarioValidationError[] {
  // Scenario fixtures arrive as untrusted JSON: validate runtime shapes before
  // dereferencing so malformed input produces field errors instead of throwing.
  const rawInteractables = scenario.interactables as unknown;
  if (rawInteractables === undefined) return [];
  if (!Array.isArray(rawInteractables)) {
    return [{ field: 'interactables', message: 'interactables must be an array of placement objects.' }];
  }
  return rawInteractables.flatMap((rawPlacement, i) => {
    const field = `interactables[${i}]`;
    const placement = rawPlacement as NonNullable<ScenarioFixture['interactables']>[number];
    if (!isObject(placement)) {
      return [{ field, message: `interactable placement must be a { templateId, position } object, got ${JSON.stringify(rawPlacement)}.` }];
    }
    const templateIdErrors: ScenarioValidationError[] = typeof placement.templateId !== 'string'
      ? [{ field: `${field}.templateId`, message: `interactable templateId must be a string, got ${JSON.stringify(placement.templateId)}.` }]
      : !OBJECT_TEMPLATES.has(placement.templateId)
      ? [{ field: `${field}.templateId`, message: `Unknown object template id "${placement.templateId}". Must exist in OBJECT_TEMPLATES.` }]
      : [];

    let positionErrors: ScenarioValidationError[];
    if (!isPositionLike(placement.position)) {
      positionErrors = [{ field: `${field}.position`, message: `interactable position must be a { x, y } object, got ${JSON.stringify(placement.position)}.` }];
    } else if (!inBounds(placement.position)) {
      positionErrors = [{ field: `${field}.position`, message: `interactable position ${JSON.stringify(placement.position)} is out of bounds.` }];
    } else {
      const key = posKey(placement.position);
      if (!isWalkable(placement.position)) {
        positionErrors = [{ field: `${field}.position`, message: `interactable cannot be placed on a non-walkable cell at ${key}.` }];
      } else {
        const existing = occupied.get(key);
        const overlapError: ScenarioValidationError[] = existing !== undefined
          ? [{ field: `${field}.position`, message: `interactable overlaps an existing placement (${existing}) at ${key}.` }]
          : [];
        if (existing === undefined) {
          occupied.set(key, `interactables[${i}]`);
        }
        positionErrors = overlapError;
      }
    }

    return [...templateIdErrors, ...positionErrors];
  });
}
