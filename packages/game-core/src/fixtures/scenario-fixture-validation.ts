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
  // Mutable accumulator: validators push as they find problems. Exposed as a
  // readonly array on the result so callers cannot mutate it.
  const mutableErrors: ScenarioValidationError[] = [];
  const add = (field: string, message: string): void => {
    mutableErrors.push({ field, message });
  };

  validateMeta(scenario, add);
  const composedFixtures = validateComposedFixtures(scenario, resolvers, add);
  validateMapAndPlacements(scenario, resolveWorldFactions(composedFixtures.world), add);

  return { isValid: mutableErrors.length === 0, errors: mutableErrors };
}

type AddError = (field: string, message: string) => void;

interface ValidatedComposedFixtures {
  readonly world: WorldState | null;
}

function validateMeta(scenario: ScenarioFixture, add: AddError): void {
  if (scenario.schemaVersion !== SCENARIO_FIXTURE_SCHEMA_VERSION) {
    add('schemaVersion', `Unsupported scenario schemaVersion ${scenario.schemaVersion}. Expected ${SCENARIO_FIXTURE_SCHEMA_VERSION}.`);
  }
  if (typeof scenario.name !== 'string' || scenario.name.trim().length === 0) {
    add('name', 'name must be a non-empty string.');
  }
  if (scenario.floor !== undefined && (!Number.isInteger(scenario.floor) || scenario.floor < 1)) {
    add('floor', `floor must be an integer ≥ 1, got ${scenario.floor}.`);
  }
  if (scenario.seed !== undefined && (!Number.isFinite(scenario.seed) || !Number.isInteger(scenario.seed))) {
    add('seed', `seed must be an integer, got ${scenario.seed}.`);
  }
}

function resolveValidatedWorld(
  worldResolution: { fixture: WorldFixture | null; error?: string },
  add: AddError,
): WorldState | null {
  if (worldResolution.fixture === null) {
    add('world', worldResolution.error ?? 'world fixture could not be resolved.');
    return null;
  }
  const worldValidation = validateWorldFixture(worldResolution.fixture);
  if (worldValidation.isValid === false) {
    for (const e of worldValidation.errors) add(`world.${e.field}`, e.message);
    return null;
  }
  return loadWorldFromValidatedFixture(worldResolution.fixture);
}

function validateComposedFixtures(
  scenario: ScenarioFixture,
  resolvers: ScenarioResolvers | undefined,
  add: AddError,
): ValidatedComposedFixtures {
  const playerResolution = resolveScenarioPlayer(scenario, resolvers);
  if (playerResolution.fixture === null) {
    add('player', playerResolution.error ?? 'player fixture could not be resolved.');
  } else {
    const playerValidation = validatePlayerFixture(playerResolution.fixture);
    if (playerValidation.isValid === false) {
      for (const e of playerValidation.errors) add(`player.${e.field}`, e.message);
    }
  }

  const world = resolveValidatedWorld(resolveScenarioWorld(scenario, resolvers), add);

  return { world };
}

function resolveWorldFactions(
  world: WorldState | null,
): readonly FactionState[] {
  return world?.factions ?? [];
}

function validateMapAndPlacements(
  scenario: ScenarioFixture,
  worldFactions: readonly FactionState[],
  add: AddError,
): void {
  // Scenario fixtures arrive as untrusted JSON: validate runtime shapes before
  // dereferencing so malformed input produces field errors instead of throwing.
  const map = scenario.map as unknown;
  if (!isObject(map)) {
    add('map', 'map is required.');
    return;
  }

  const widthValid = Number.isInteger(map.width) && (map.width as number) >= 1;
  const heightValid = Number.isInteger(map.height) && (map.height as number) >= 1;
  if (widthValid === false) {
    add('map.width', `map.width must be an integer ≥ 1, got ${JSON.stringify(map.width)}.`);
  }
  if (heightValid === false) {
    add('map.height', `map.height must be an integer ≥ 1, got ${JSON.stringify(map.height)}.`);
  }
  // Bail out before using width/height: continuing with invalid dimensions
  // produces confusing bounds messages and cascades into placement errors.
  if (widthValid === false || heightValid === false) {
    return;
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
  if (rawWalls !== undefined && !Array.isArray(rawWalls)) add('map.walls', 'map.walls must be an array of { x, y } coordinates.');
  if (rawFloors !== undefined && !Array.isArray(rawFloors)) add('map.floors', 'map.floors must be an array of { x, y } coordinates.');
  if (rawSpawns !== undefined && !Array.isArray(rawSpawns)) add('map.spawns', 'map.spawns must be an array of { name, position } objects.');
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
  if (!isPositionLike(playerStart) || !inBounds(playerStart)) {
    add('map.playerStart', `map.playerStart must be an in-bounds coordinate within [0,${width}) × [0,${height}), got ${JSON.stringify(map.playerStart)}.`);
  } else if (wallSet.has(posKey(playerStart))) {
    add('map.playerStart', `map.playerStart ${posKey(playerStart)} cannot be on a wall.`);
  } else {
    occupied.set(posKey(playerStart), 'playerStart');
  }

  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    if (!isPositionLike(wall)) {
      add(`map.walls[${i}]`, `wall coordinate ${JSON.stringify(wall)} must be a { x, y } object.`);
    } else if (!inBounds(wall)) {
      add(`map.walls[${i}]`, `wall coordinate ${JSON.stringify(wall)} is out of bounds.`);
    }
  }

  for (let i = 0; i < floors.length; i++) {
    const floor = floors[i];
    if (!isPositionLike(floor)) {
      add(`map.floors[${i}]`, `floor coordinate ${JSON.stringify(floor)} must be a { x, y } object.`);
    } else if (!inBounds(floor)) {
      add(`map.floors[${i}]`, `floor coordinate ${JSON.stringify(floor)} is out of bounds.`);
    }
  }

  const seenNames = new Set<string>();
  for (let i = 0; i < spawns.length; i++) {
    const spawn = spawns[i];
    if (!isSpawnLike(spawn)) {
      add(`map.spawns[${i}]`, `spawn must be a { name, position } object, got ${JSON.stringify(spawn)}.`);
      continue;
    }
    if (seenNames.has(spawn.name)) {
      add(`map.spawns[${i}].name`, `Duplicate spawn name "${spawn.name}". Spawn names must be unique.`);
    }
    seenNames.add(spawn.name);
    if (!inBounds(spawn.position)) {
      add(`map.spawns[${i}].position`, `spawn "${spawn.name}" position ${JSON.stringify(spawn.position)} is out of bounds.`);
    } else if (wallSet.has(posKey(spawn.position))) {
      add(`map.spawns[${i}].position`, `spawn "${spawn.name}" cannot be placed on a wall.`);
    }
  }

  validateEnemyPlacements(scenario, floorNumber(scenario), worldFactions, inBounds, isWalkable, occupied, add);
  validateLootPlacements(scenario, inBounds, isWalkable, occupied, add);
  validateInteractablePlacements(scenario, inBounds, isWalkable, occupied, add);
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
  add: AddError,
): void {
  // Scenario fixtures arrive as untrusted JSON: validate runtime shapes before
  // dereferencing so malformed input produces field errors instead of throwing.
  const rawEnemies = scenario.enemies as unknown;
  if (rawEnemies === undefined) return;
  if (!Array.isArray(rawEnemies)) {
    add('enemies', 'enemies must be an array of placement objects.');
    return;
  }
  for (let i = 0; i < rawEnemies.length; i++) {
    const field = `enemies[${i}]`;
    const placement = rawEnemies[i] as NonNullable<ScenarioFixture['enemies']>[number];
    if (!isObject(placement)) {
      add(field, `enemy placement must be a { templateId, position } object, got ${JSON.stringify(rawEnemies[i])}.`);
      continue;
    }

    const templateExists = typeof placement.templateId === 'string' && ENEMY_TEMPLATES.has(placement.templateId);
    if (typeof placement.templateId !== 'string') {
      add(`${field}.templateId`, `enemy templateId must be a string, got ${JSON.stringify(placement.templateId)}.`);
    } else if (templateExists === false) {
      add(`${field}.templateId`, `Unknown enemy template id "${placement.templateId}". Must exist in ENEMY_TEMPLATES.`);
    }

    const positionValid = isPositionLike(placement.position);
    if (positionValid === false) {
      add(`${field}.position`, `enemy position must be a { x, y } object, got ${JSON.stringify(placement.position)}.`);
    } else if (!inBounds(placement.position)) {
      add(`${field}.position`, `enemy position ${JSON.stringify(placement.position)} is out of bounds.`);
    } else {
      const key = posKey(placement.position);
      if (!isWalkable(placement.position)) {
        add(`${field}.position`, `enemy cannot be placed on a non-walkable cell at ${key}.`);
      }
      const existing = occupied.get(key);
      if (existing !== undefined) {
        add(`${field}.position`, `enemy overlaps an existing placement (${existing}) at ${key}.`);
      } else {
        occupied.set(key, `enemies[${i}]`);
      }
    }

    if (placement.level !== undefined && (!Number.isInteger(placement.level) || placement.level < 1)) {
      add(`${field}.level`, `enemy level override must be an integer ≥ 1, got ${placement.level}.`);
    }
    if (placement.health !== undefined && (!Number.isFinite(placement.health) || placement.health <= 0)) {
      add(`${field}.health`, `enemy health override must be a positive number, got ${placement.health}.`);
    }
    if (placement.healthMultiplier !== undefined && (!Number.isFinite(placement.healthMultiplier) || placement.healthMultiplier <= 0)) {
      add(`${field}.healthMultiplier`, `enemy healthMultiplier must be a positive number, got ${placement.healthMultiplier}.`);
    }
    if (placement.statuses !== undefined) {
      if (!Array.isArray(placement.statuses)) {
        add(`${field}.statuses`, `enemy statuses must be an array of status ids, got ${JSON.stringify(placement.statuses)}.`);
      } else {
        for (const statusId of placement.statuses) {
          if (typeof statusId !== 'string' || !STATUS_DEFINITIONS.has(statusId)) {
            add(`${field}.statuses`, `Unknown status id ${JSON.stringify(statusId)}. Valid: ${[...STATUS_DEFINITIONS.keys()].join(', ')}.`);
          }
        }
      }
    }

    // Health override must not exceed the scaled maxHealth the runtime factory
    // would produce. Compute it with the same factory to avoid duplicating
    // scaling math.
    const levelIsValid = placement.level === undefined || (Number.isInteger(placement.level) && placement.level >= 1);
    const healthMultiplierIsValid = placement.healthMultiplier === undefined
      || (Number.isFinite(placement.healthMultiplier) && placement.healthMultiplier > 0);
    const healthIsValid = placement.health !== undefined && Number.isFinite(placement.health) && placement.health > 0;

    if (templateExists && positionValid && healthIsValid && levelIsValid && healthMultiplierIsValid) {
      const template = ENEMY_TEMPLATES.get(placement.templateId)!;
      const depth = placement.level ?? defaultDepth;
      const scaled = createEnemyInstance(template, { ...placement.position }, depth, {
        id: entityId('scenario_validate_probe'),
        factions: worldFactions,
        ...(placement.healthMultiplier !== undefined ? { enemyHealthMultiplier: placement.healthMultiplier } : {}),
      });
      if (placement.health > scaled.stats.maxHealth) {
        add(`${field}.health`, `enemy health override (${placement.health}) cannot exceed scaled maxHealth (${scaled.stats.maxHealth}).`);
      }
    }
  }
}

function validateLootPlacements(
  scenario: ScenarioFixture,
  inBounds: (p: Position) => boolean,
  isWalkable: (p: Position) => boolean,
  occupied: Map<string, string>,
  add: AddError,
): void {
  // Scenario fixtures arrive as untrusted JSON: validate runtime shapes before
  // dereferencing so malformed input produces field errors instead of throwing.
  const rawLoot = scenario.loot as unknown;
  if (rawLoot === undefined) return;
  if (!Array.isArray(rawLoot)) {
    add('loot', 'loot must be an array of placement objects.');
    return;
  }
  for (let i = 0; i < rawLoot.length; i++) {
    const field = `loot[${i}]`;
    const placement = rawLoot[i] as NonNullable<ScenarioFixture['loot']>[number];
    if (!isObject(placement)) {
      add(field, `loot placement must be a { itemId, position } object, got ${JSON.stringify(rawLoot[i])}.`);
      continue;
    }
    if (typeof placement.itemId !== 'string') {
      add(`${field}.itemId`, `loot itemId must be a string, got ${JSON.stringify(placement.itemId)}.`);
    } else if (!ITEM_BY_ID.has(placement.itemId)) {
      add(`${field}.itemId`, `Unknown item id "${placement.itemId}". Must exist in ITEM_BY_ID.`);
    }
    if (!isPositionLike(placement.position)) {
      add(`${field}.position`, `loot position must be a { x, y } object, got ${JSON.stringify(placement.position)}.`);
    } else if (!inBounds(placement.position)) {
      add(`${field}.position`, `loot position ${JSON.stringify(placement.position)} is out of bounds.`);
    } else {
      const key = posKey(placement.position);
      if (!isWalkable(placement.position)) {
        add(`${field}.position`, `loot cannot be placed on a non-walkable cell at ${key}.`);
      }
      const existing = occupied.get(key);
      if (existing !== undefined) {
        add(`${field}.position`, `loot overlaps an existing placement (${existing}) at ${key}.`);
      } else {
        occupied.set(key, `loot[${i}]`);
      }
    }
  }
}

function validateInteractablePlacements(
  scenario: ScenarioFixture,
  inBounds: (p: Position) => boolean,
  isWalkable: (p: Position) => boolean,
  occupied: Map<string, string>,
  add: AddError,
): void {
  // Scenario fixtures arrive as untrusted JSON: validate runtime shapes before
  // dereferencing so malformed input produces field errors instead of throwing.
  const rawInteractables = scenario.interactables as unknown;
  if (rawInteractables === undefined) return;
  if (!Array.isArray(rawInteractables)) {
    add('interactables', 'interactables must be an array of placement objects.');
    return;
  }
  for (let i = 0; i < rawInteractables.length; i++) {
    const field = `interactables[${i}]`;
    const placement = rawInteractables[i] as NonNullable<ScenarioFixture['interactables']>[number];
    if (!isObject(placement)) {
      add(field, `interactable placement must be a { templateId, position } object, got ${JSON.stringify(rawInteractables[i])}.`);
      continue;
    }
    if (typeof placement.templateId !== 'string') {
      add(`${field}.templateId`, `interactable templateId must be a string, got ${JSON.stringify(placement.templateId)}.`);
    } else if (!OBJECT_TEMPLATES.has(placement.templateId)) {
      add(`${field}.templateId`, `Unknown object template id "${placement.templateId}". Must exist in OBJECT_TEMPLATES.`);
    }
    if (!isPositionLike(placement.position)) {
      add(`${field}.position`, `interactable position must be a { x, y } object, got ${JSON.stringify(placement.position)}.`);
    } else if (!inBounds(placement.position)) {
      add(`${field}.position`, `interactable position ${JSON.stringify(placement.position)} is out of bounds.`);
    } else {
      const key = posKey(placement.position);
      if (!isWalkable(placement.position)) {
        add(`${field}.position`, `interactable cannot be placed on a non-walkable cell at ${key}.`);
      } else {
        const existing = occupied.get(key);
        if (existing !== undefined) {
          add(`${field}.position`, `interactable overlaps an existing placement (${existing}) at ${key}.`);
        } else {
          occupied.set(key, `interactables[${i}]`);
        }
      }
    }
  }
}
