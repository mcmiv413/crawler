/**
 * Scenario Fixture Loader — Phase 2
 *
 * Composes player + world fixtures with an explicit dungeon map, enemy
 * placements, and loot placements into a complete, engine-ready GameState.
 *
 * Design contract:
 *   - Reuses existing fixture validators and runtime factories; never
 *     duplicates player/world fixture logic.
 *   - Uses the same enemy instantiation path as floor population, so placed
 *     enemies behave exactly like naturally spawned ones.
 *   - Fully deterministic: no randomness occurs during scenario construction.
 *     Entity IDs are assigned from a stable counter, not generateId().
 *   - All validation happens before any state is built; invalid scenarios fail
 *     loudly with explicit, field-specific error messages.
 */

import type {
  GameState,
  RunState,
  DungeonFloor,
  MapCell,
  Tile,
  EnemyInstance,
  ObjectInstance,
  StatusId,
  FactionState,
} from '@dungeon/contracts';
import {
  entityId,
  posKey,
  EMPTY_WEAPON_MASTERY,
  EMPTY_RUN_METRICS,
} from '@dungeon/contracts';
import { ENEMY_TEMPLATES, STATUS_DEFAULTS } from '@dungeon/content';

import { loadPlayerFromFixture } from './player-fixture-loader.js';
import { loadWorldFromFixture } from './world-fixture-loader.js';
import { createEnemyInstance } from '../generation/enemy-instantiation.js';
import { applyStatusToEnemy } from '../systems/status-effects.js';
import { syncEquipmentGrantedAbilities } from '../systems/equipment.js';
import { computeFov } from '../systems/fov.js';
import {
  validateScenarioFixture,
  resolveScenarioPlayer,
  resolveScenarioWorld,
} from './scenario-fixture-validation.js';
import type {
  ScenarioFixture,
  ScenarioMapFixture,
  ScenarioResolvers,
  ScenarioValidationError,
  ScenarioLoadResult,
  ScenarioResolvedLoot,
} from './scenario-fixture-types.js';

export {
  validateScenarioFixture,
  SCENARIO_FIXTURE_SCHEMA_VERSION,
} from './scenario-fixture-validation.js';

const FLOOR_TILE: Tile = {
  type: 'floor',
  walkable: true,
  blocksVision: false,
  ascii: '.',
  color: '#888888',
};

const WALL_TILE: Tile = {
  type: 'wall',
  walkable: false,
  blocksVision: true,
  ascii: '#',
  color: '#444444',
};

/**
 * Error thrown when a scenario fails validation during loading.
 */
export class ScenarioLoadError extends Error {
  readonly validationErrors: readonly ScenarioValidationError[];

  constructor(message: string, validationErrors: readonly ScenarioValidationError[]) {
    super(message);
    this.name = 'ScenarioLoadError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Load a ScenarioFixture into a complete, engine-ready GameState.
 *
 * Validates first; throws ScenarioLoadError on any validation failure. Loading
 * is fully deterministic. The resulting GameState is in the dungeon phase and
 * is indistinguishable from a naturally reached gameplay state.
 */
export function loadScenario(
  scenario: ScenarioFixture,
  resolvers?: ScenarioResolvers,
): ScenarioLoadResult {
  const validation = validateScenarioFixture(scenario, resolvers);
  if (validation.isValid === false) {
    const messages = validation.errors.map(e => `  [${e.field}] ${e.message}`).join('\n');
    throw new ScenarioLoadError(
      `Invalid scenario fixture "${scenario.name}" — ${validation.errors.length} error(s):\n${messages}`,
      validation.errors,
    );
  }

  return buildScenarioState(scenario, resolvers);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal construction helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildScenarioState(
  scenario: ScenarioFixture,
  resolvers: ScenarioResolvers | undefined,
): ScenarioLoadResult {
  const floorNumber = scenario.floor ?? 1;
  const seed = scenario.seed ?? 1;
  // Derive IDs from name + seed so distinct scenarios loaded without an
  // explicit seed (which defaults to 1) do not collide on runId/gameId.
  const idToken = `${scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_${seed}`;

  // Compose player + world from existing loaders (no duplicated logic).
  const playerFixture = resolveScenarioPlayer(scenario, resolvers).fixture!;
  const worldFixture = resolveScenarioWorld(scenario, resolvers).fixture!;
  const { player: loadedPlayer, itemRegistry: playerRegistry } = loadPlayerFromFixture(playerFixture);
  const world = loadWorldFromFixture(worldFixture);

  // Grant abilities from equipped items (rings, ability-granting enchantments)
  // so a scenario-loaded player can actually use its learned ring spells, just
  // like natural gameplay where equipping a ring syncs granted abilities. Without
  // this, casts are rejected as ABILITY_NOT_UNLOCKED despite learnedRingSpellIds.
  const equippedPlayer = syncEquipmentGrantedAbilities(loadedPlayer, playerRegistry.items);

  // Position the player at the map start and onto the floor.
  const player = {
    ...equippedPlayer,
    position: { ...scenario.map.playerStart },
    floor: floorNumber,
  };

  const floor = buildFloor(scenario.map, floorNumber, seed);
  const enemies = buildEnemies(scenario, floorNumber, world.factions);
  const objects = buildObjects(scenario);

  // Item registry carries the player's items. Loot is reported separately for
  // runtime collection (addItemToInventory registers it on pickup, exactly
  // like generated drops).
  const itemRegistry = { items: new Map(playerRegistry.items) };

  const loot: ScenarioResolvedLoot[] = (scenario.loot ?? []).map(l => ({
    itemId: l.itemId,
    position: { ...l.position },
  }));

  const speedAccumulators: Record<string, number> = {};
  for (const enemy of enemies.values()) {
    speedAccumulators[enemy.id] = 0;
  }

  const run: RunState = {
    runId: entityId(`scenario_run_${idToken}`),
    floor,
    enemies,
    objects,
    turnCount: 0,
    isActive: true,
    runMetrics: EMPTY_RUN_METRICS,
    floorHistory: [],
    floorCache: new Map(),
    speedAccumulators,
  };

  const state: GameState = {
    gameId: entityId(`scenario_${idToken}`),
    phase: 'dungeon',
    player,
    run,
    world,
    itemRegistry,
    seed,
    turnNumber: 0,
    version: 1,
    activeQuests: [],
    weaponMastery: EMPTY_WEAPON_MASTERY,
  };

  return { state, loot };
}

/** Build a fully explicit DungeonFloor from a map fixture. */
function buildFloor(map: ScenarioMapFixture, depth: number, seed: number): DungeonFloor {
  const wallSet = new Set<string>((map.walls ?? []).map(posKey));

  // When an explicit floor list is provided, every other in-bounds cell that is
  // not the player start or a spawn point becomes a wall.
  const explicitFloors = map.floors !== undefined
    ? new Set<string>([
        ...map.floors.map(posKey),
        posKey(map.playerStart),
        ...(map.spawns ?? []).map(s => posKey(s.position)),
      ])
    : null;

  const cells = new Map<string, MapCell>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const key = posKey({ x, y });
      let isWall = wallSet.has(key);
      if (explicitFloors !== null && !explicitFloors.has(key)) {
        isWall = true;
      }
      cells.set(key, {
        tile: isWall === true ? WALL_TILE : FLOOR_TILE,
        // Start hidden and reveal via computeFov below, matching the generated
        // floor path (floor-transition-service.buildVisibleFloor). Initializing
        // every cell as 'visible' would make the first in-game computeFov mark
        // unseen tiles as 'remembered', diverging from natural play.
        visibility: 'hidden',
      });
    }
  }

  // Exit defaults to the far corner if walkable, otherwise the player start
  // (purely informational for scenarios).
  const exitCandidate = { x: map.width - 1, y: map.height - 1 };
  const exit = cells.get(posKey(exitCandidate))?.tile.walkable === true
    ? exitCandidate
    : { ...map.playerStart };

  const floor: DungeonFloor = {
    width: map.width,
    height: map.height,
    depth,
    biomeId: 'crypt',
    cells,
    entrance: { ...map.playerStart },
    exit,
    seed,
  };

  // Reveal the player's starting field of view exactly as the engine does.
  return { ...floor, cells: computeFov(floor, map.playerStart) };
}

/**
 * Build the enemy map using createEnemyInstance (the runtime factory), then
 * apply optional health and status overrides. Entity IDs are deterministic.
 */
function buildEnemies(
  scenario: ScenarioFixture,
  floorNumber: number,
  factions: ReadonlyArray<FactionState>,
): Map<string, EnemyInstance> {
  const enemies = new Map<string, EnemyInstance>();
  const placements = scenario.enemies ?? [];

  for (let i = 0; i < placements.length; i++) {
    const placement = placements[i]!;
    const template = ENEMY_TEMPLATES.get(placement.templateId)!;
    const depth = placement.level ?? floorNumber;

    let enemy = createEnemyInstance(template, { ...placement.position }, depth, {
      id: entityId(`scenario_enemy_${i + 1}`),
      factions: [...factions],
      ...(placement.healthMultiplier !== undefined ? { enemyHealthMultiplier: placement.healthMultiplier } : {}),
    });

    // Health override: clamp current health, keep scaled maxHealth.
    if (placement.health !== undefined) {
      const clamped = Math.min(placement.health, enemy.stats.maxHealth);
      enemy = { ...enemy, stats: { ...enemy.stats, health: clamped } };
    }

    // Status overrides through the runtime status system.
    if (placement.statuses !== undefined) {
      for (const statusId of placement.statuses) {
        const sid = statusId as StatusId;
        const defaults = (STATUS_DEFAULTS as Record<string, { defaultDuration?: number }>)[sid];
        const duration = defaults?.defaultDuration ?? 3;
        // Magnitude 0 leaves magnitude-driven statuses (strength, arcane_charge,
        // burn scaling) inert; normal gameplay applies magnitude >= 1, so match it.
        enemy = applyStatusToEnemy(enemy, sid, duration, 1, null);
      }
    }

    enemies.set(posKey(placement.position), enemy);
  }

  return enemies;
}

/** Build the interactable object map. Entity IDs are deterministic. */
function buildObjects(scenario: ScenarioFixture): Map<string, ObjectInstance> {
  const objects = new Map<string, ObjectInstance>();
  const placements = scenario.interactables ?? [];
  for (let i = 0; i < placements.length; i++) {
    const placement = placements[i]!;
    const instance: ObjectInstance = {
      id: entityId(`scenario_object_${i + 1}`),
      templateId: placement.templateId,
      position: { ...placement.position },
      isExhausted: false,
    };
    objects.set(posKey(placement.position), instance);
  }
  return objects;
}
