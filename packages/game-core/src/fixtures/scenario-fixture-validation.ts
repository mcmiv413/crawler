/**
 * Scenario Fixture Validation — Phase 2
 *
 * Pure validation for scenario fixtures plus reference resolution. Reuses the
 * existing player/world fixture validators rather than re-implementing their
 * rules, and never adds scenario-specific exceptions to runtime systems.
 */

import type { FactionState, Position } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';
import {
  ENEMY_TEMPLATES,
  ITEM_BY_ID,
  OBJECT_TEMPLATES,
  STATUS_DEFINITIONS,
} from '@dungeon/content';

import { validatePlayerFixture } from './player-fixture-loader.js';
import { loadWorldFromFixture, validateWorldFixture } from './world-fixture-loader.js';
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
export function resolveScenarioPlayer(
  scenario: ScenarioFixture,
  resolvers: ScenarioResolvers | undefined,
): { fixture: PlayerFixture | null; error?: string } {
  if (scenario.player.inline !== undefined) {
    return { fixture: scenario.player.inline };
  }
  if (scenario.player.ref !== undefined) {
    if (resolvers === undefined) {
      return { fixture: null, error: `player.ref "${scenario.player.ref}" requires resolvers but none were supplied.` };
    }
    try {
      return { fixture: resolvers.resolvePlayerFixture(scenario.player.ref) };
    } catch (err) {
      return { fixture: null, error: `Unknown player fixture reference "${scenario.player.ref}": ${(err as Error).message}` };
    }
  }
  return { fixture: null, error: 'player must specify either inline or ref.' };
}

export function resolveScenarioWorld(
  scenario: ScenarioFixture,
  resolvers: ScenarioResolvers | undefined,
): { fixture: WorldFixture | null; error?: string } {
  if (scenario.world.inline !== undefined) {
    return { fixture: scenario.world.inline };
  }
  if (scenario.world.ref !== undefined) {
    if (resolvers === undefined) {
      return { fixture: null, error: `world.ref "${scenario.world.ref}" requires resolvers but none were supplied.` };
    }
    try {
      return { fixture: resolvers.resolveWorldFixture(scenario.world.ref) };
    } catch (err) {
      return { fixture: null, error: `Unknown world fixture reference "${scenario.world.ref}": ${(err as Error).message}` };
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
  let errors: ScenarioValidationError[] = [];
  const add = (field: string, message: string): void => {
    errors = [...errors, { field, message }];
  };

  validateMeta(scenario, add);
  validateComposedFixtures(scenario, resolvers, add);
  validateMapAndPlacements(scenario, resolveWorldFactions(scenario, resolvers), add);

  return { isValid: errors.length === 0, errors };
}

type AddError = (field: string, message: string) => void;

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

function validateComposedFixtures(
  scenario: ScenarioFixture,
  resolvers: ScenarioResolvers | undefined,
  add: AddError,
): void {
  const playerResolution = resolveScenarioPlayer(scenario, resolvers);
  if (playerResolution.fixture === null) {
    add('player', playerResolution.error ?? 'player fixture could not be resolved.');
  } else {
    const playerValidation = validatePlayerFixture(playerResolution.fixture);
    if (playerValidation.isValid === false) {
      for (const e of playerValidation.errors) add(`player.${e.field}`, e.message);
    }
  }

  const worldResolution = resolveScenarioWorld(scenario, resolvers);
  if (worldResolution.fixture === null) {
    add('world', worldResolution.error ?? 'world fixture could not be resolved.');
  } else {
    const worldValidation = validateWorldFixture(worldResolution.fixture);
    if (worldValidation.isValid === false) {
      for (const e of worldValidation.errors) add(`world.${e.field}`, e.message);
    }
  }
}

function resolveWorldFactions(
  scenario: ScenarioFixture,
  resolvers: ScenarioResolvers | undefined,
): readonly FactionState[] {
  const worldResolution = resolveScenarioWorld(scenario, resolvers);
  if (worldResolution.fixture === null) return [];
  const worldValidation = validateWorldFixture(worldResolution.fixture);
  if (worldValidation.isValid === false) return [];
  return loadWorldFromFixture(worldResolution.fixture).factions;
}

function validateMapAndPlacements(
  scenario: ScenarioFixture,
  worldFactions: readonly FactionState[],
  add: AddError,
): void {
  // Cast through unknown: scenario fixtures arrive as untrusted JSON, so the
  // statically-required map/playerStart may be missing at runtime.
  const map = scenario.map as ScenarioFixture['map'] | undefined;
  if (map === undefined) {
    add('map', 'map is required.');
    return;
  }

  if (!Number.isInteger(map.width) || map.width < 1) {
    add('map.width', `map.width must be an integer ≥ 1, got ${map.width}.`);
  }
  if (!Number.isInteger(map.height) || map.height < 1) {
    add('map.height', `map.height must be an integer ≥ 1, got ${map.height}.`);
  }

  const inBounds = (p: Position): boolean =>
    Number.isInteger(p.x) && Number.isInteger(p.y)
    && p.x >= 0 && p.x < map.width && p.y >= 0 && p.y < map.height;

  const wallSet = new Set<string>((map.walls ?? []).map(posKey));
  const occupied = new Map<string, string>();

  // When an explicit floor list is provided, only those cells (plus the player
  // start and named spawns) are walkable; everything else is a wall.
  const explicitFloors = map.floors !== undefined
    ? new Set<string>([
        ...map.floors.map(posKey),
        posKey(map.playerStart),
        ...(map.spawns ?? []).map(s => posKey(s.position)),
      ])
    : null;
  const isWalkable = (p: Position): boolean =>
    !wallSet.has(posKey(p)) && (explicitFloors === null || explicitFloors.has(posKey(p)));

  // playerStart (untrusted JSON: may be missing at runtime)
  const playerStart = map.playerStart as Position | undefined;
  if (playerStart === undefined || !inBounds(playerStart)) {
    add('map.playerStart', `map.playerStart must be an in-bounds coordinate within [0,${map.width}) × [0,${map.height}), got ${JSON.stringify(map.playerStart)}.`);
  } else if (wallSet.has(posKey(map.playerStart))) {
    add('map.playerStart', `map.playerStart ${posKey(map.playerStart)} cannot be on a wall.`);
  } else {
    occupied.set(posKey(map.playerStart), 'playerStart');
  }

  if (map.walls !== undefined) {
    for (let i = 0; i < map.walls.length; i++) {
      if (!inBounds(map.walls[i]!)) add(`map.walls[${i}]`, `wall coordinate ${JSON.stringify(map.walls[i])} is out of bounds.`);
    }
  }

  if (map.floors !== undefined) {
    for (let i = 0; i < map.floors.length; i++) {
      if (!inBounds(map.floors[i]!)) add(`map.floors[${i}]`, `floor coordinate ${JSON.stringify(map.floors[i])} is out of bounds.`);
    }
  }

  if (map.spawns !== undefined) {
    const seenNames = new Set<string>();
    for (let i = 0; i < map.spawns.length; i++) {
      const spawn = map.spawns[i]!;
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
  if (scenario.enemies === undefined) return;
  for (let i = 0; i < scenario.enemies.length; i++) {
    const placement = scenario.enemies[i]!;
    const field = `enemies[${i}]`;
    const templateExists = ENEMY_TEMPLATES.has(placement.templateId);

    if (templateExists === false) {
      add(`${field}.templateId`, `Unknown enemy template id "${placement.templateId}". Must exist in ENEMY_TEMPLATES.`);
    }

    if (!inBounds(placement.position)) {
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
      for (const statusId of placement.statuses) {
        if (!STATUS_DEFINITIONS.has(statusId)) {
          add(`${field}.statuses`, `Unknown status id "${statusId}". Valid: ${[...STATUS_DEFINITIONS.keys()].join(', ')}.`);
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

    if (templateExists && healthIsValid && levelIsValid && healthMultiplierIsValid) {
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
  if (scenario.loot === undefined) return;
  for (let i = 0; i < scenario.loot.length; i++) {
    const placement = scenario.loot[i]!;
    const field = `loot[${i}]`;
    if (!ITEM_BY_ID.has(placement.itemId)) {
      add(`${field}.itemId`, `Unknown item id "${placement.itemId}". Must exist in ITEM_BY_ID.`);
    }
    if (!inBounds(placement.position)) {
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
  if (scenario.interactables === undefined) return;
  for (let i = 0; i < scenario.interactables.length; i++) {
    const placement = scenario.interactables[i]!;
    const field = `interactables[${i}]`;
    if (!OBJECT_TEMPLATES.has(placement.templateId)) {
      add(`${field}.templateId`, `Unknown object template id "${placement.templateId}". Must exist in OBJECT_TEMPLATES.`);
    }
    if (!inBounds(placement.position)) {
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
