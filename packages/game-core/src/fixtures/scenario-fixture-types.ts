/**
 * ScenarioFixture — schema types for scenario fixture files (Phase 2).
 *
 * A scenario fixture composes existing fixture systems (player + world) with an
 * explicit dungeon map, enemy placements, and loot placements to describe a
 * complete, playable game situation that can be loaded directly into the engine.
 *
 * Scenarios describe gameplay concepts (fixture references, content IDs, grid
 * coordinates) rather than GameState internals, so files stay stable even when
 * engine implementation changes.
 *
 * Forbidden in scenario fixtures (runtime-only / derived data):
 *   - resolved EntityId values (assigned deterministically at load time)
 *   - procedurally generated maps (maps must be fully explicit)
 *   - rendering / animation / UI state
 *   - cached calculations or engine bookkeeping
 */

import type { Position, GameState } from '@dungeon/contracts';
import type { PlayerFixture } from './player-fixture-types.js';
import type { WorldFixture } from './world-fixture-types.js';

/**
 * Map fixture — a fully explicit, deterministic dungeon floor.
 *
 * No procedural generation and no randomness occur; every walkable and blocked
 * cell is described directly. Cells not listed as walls and within bounds are
 * treated as floor.
 */
export interface ScenarioMapFixture {
  /** Grid width in tiles (≥ 1). */
  readonly width: number;

  /** Grid height in tiles (≥ 1). */
  readonly height: number;

  /**
   * Wall coordinates. Every listed coordinate becomes a non-walkable,
   * vision-blocking wall tile. Must be within [0,width) × [0,height).
   */
  readonly walls?: readonly Position[];

  /**
   * Explicit floor coordinates. When omitted, every in-bounds non-wall cell is
   * a floor tile. When provided, only listed cells (plus the player start and
   * spawn points) are floor; all other in-bounds cells are walls.
   */
  readonly floors?: readonly Position[];

  /** Player start position. Must be in-bounds and walkable. */
  readonly playerStart: Position;

  /**
   * Named spawn locations for documentation / reuse. Names must be unique.
   * These do not place entities by themselves; enemy/loot placements reference
   * coordinates directly.
   */
  readonly spawns?: readonly ScenarioNamedSpawn[];
}

/** A named, reusable spawn coordinate within a map fixture. */
export interface ScenarioNamedSpawn {
  /** Unique identifier within the scenario (e.g. "ambush", "boss"). */
  readonly name: string;
  /** Grid coordinate. Must be in-bounds and walkable. */
  readonly position: Position;
}

/**
 * Explicit enemy placement. Templates are instantiated through the same
 * runtime factory used by floor population, so placed enemies behave exactly
 * like naturally spawned ones.
 */
export interface ScenarioEnemyPlacement {
  /** Enemy template id (e.g. "goblin_archer"). Must exist in ENEMY_TEMPLATES. */
  readonly templateId: string;

  /** Grid coordinate. Must be in-bounds, walkable, and not overlap another entity. */
  readonly position: Position;

  /**
   * Optional depth/level override used for stat scaling. Defaults to the
   * scenario floor number. Must be ≥ 1 when present.
   */
  readonly level?: number;

  /**
   * Optional current-health override applied after scaling.
   * Must be > 0 and ≤ the scaled maxHealth.
   */
  readonly health?: number;

  /**
   * Optional status effect ids to apply on spawn (e.g. "burn").
   * Each must exist in STATUS_DEFINITIONS.
   */
  readonly statuses?: readonly string[];

  /**
   * Optional explicit enemy multiplier on max health (defaults to 1).
   * Must be > 0 when present.
   */
  readonly healthMultiplier?: number;
}

/**
 * Explicit loot placement. The item template is resolved at load time and made
 * available for collection through the same runtime path used by generated
 * loot, so collected scenario loot is indistinguishable from drops.
 */
export interface ScenarioLootPlacement {
  /** Item id (e.g. "health_potion"). Must exist in ITEM_BY_ID. */
  readonly itemId: string;

  /** Grid coordinate. Must be in-bounds and not overlap another entity. */
  readonly position: Position;
}

/**
 * Optional interactable placement (chests, healing fountains, traps).
 * Templates are placed into RunState.objects exactly like generated objects.
 */
export interface ScenarioInteractablePlacement {
  /** Object template id. Must exist in OBJECT_TEMPLATES. */
  readonly templateId: string;

  /** Grid coordinate. Must be in-bounds and not overlap another entity. */
  readonly position: Position;
}

/**
 * Validation error — identifies the offending field and describes the problem
 * clearly enough for a developer to fix the scenario file.
 */
export interface ScenarioValidationError {
  /** Dot-path to the offending field, e.g. "enemies[0].position". */
  readonly field: string;
  /** Human-readable description identifying the bad value and why it is invalid. */
  readonly message: string;
}

/** Result returned by validateScenarioFixture(). */
export interface ScenarioValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ScenarioValidationError[];
}

/**
 * How a scenario references its player and world fixtures.
 *
 * Either an inline fixture object or a named reference may be supplied for each.
 * Named references are resolved by the caller-supplied resolver; this keeps the
 * loader free of filesystem coupling while still allowing scenario files to
 * point at named fixtures rather than duplicating data.
 */
export interface ScenarioPlayerRef {
  /** Named player fixture (e.g. "fire-mage-mastery-test"). */
  readonly ref?: string;
  /** Inline player fixture (used when no named fixture exists). */
  readonly inline?: PlayerFixture;
}

export interface ScenarioWorldRef {
  /** Named world fixture (e.g. "ogre-emergence-world"). */
  readonly ref?: string;
  /** Inline world fixture. */
  readonly inline?: WorldFixture;
}

/**
 * ScenarioFixture schema version 1.
 *
 * Required: schemaVersion, name, player, world, map.
 * The player and world are referenced (not duplicated) per the design contract.
 */
export interface ScenarioFixture {
  /** Must equal SCENARIO_FIXTURE_SCHEMA_VERSION (currently 1). */
  readonly schemaVersion: number;

  /** Human-readable scenario name. */
  readonly name: string;

  /** Optional longer description of the situation the scenario reproduces. */
  readonly description?: string;

  /** Player fixture reference (named or inline). */
  readonly player: ScenarioPlayerRef;

  /** World fixture reference (named or inline). */
  readonly world: ScenarioWorldRef;

  /** Dungeon floor number / depth (≥ 1, default 1). Drives enemy scaling. */
  readonly floor?: number;

  /** Deterministic RNG seed for the scenario (default 1). */
  readonly seed?: number;

  /** Explicit dungeon map. */
  readonly map: ScenarioMapFixture;

  /** Enemy placements. */
  readonly enemies?: readonly ScenarioEnemyPlacement[];

  /** Loot placements. */
  readonly loot?: readonly ScenarioLootPlacement[];

  /** Optional interactable placements. */
  readonly interactables?: readonly ScenarioInteractablePlacement[];

  /** Optional free-form tags for filtering scenarios (e.g. ["combat", "fire"]). */
  readonly tags?: readonly string[];
}

/**
 * Resolvers used to turn named fixture references into concrete fixtures.
 * Supplied by the caller (tests, tooling) so the loader stays pure.
 */
export interface ScenarioResolvers {
  readonly resolvePlayerFixture: (ref: string) => PlayerFixture;
  readonly resolveWorldFixture: (ref: string) => WorldFixture;
}

/**
 * A resolved loot placement: the item template plus where it sits on the map.
 * Collecting it through addItemToInventory yields the same result as a drop.
 */
export interface ScenarioResolvedLoot {
  readonly position: Position;
  readonly itemId: string;
}

/**
 * Result returned by loadScenario().
 *
 * `state` is a fully-formed, engine-ready GameState in the dungeon phase.
 * `loot` lists resolved loot placements for runtime collection by tests/tools.
 */
export interface ScenarioLoadResult {
  readonly state: GameState;
  readonly loot: readonly ScenarioResolvedLoot[];
}
