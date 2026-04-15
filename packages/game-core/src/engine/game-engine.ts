import type { GameState, GameCommand, StoredFloor, DungeonFloor, EnemyInstance, Position } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';
import type { IGameEngine, CommandResult } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';
import { generateId } from '../utils/id.js';
import { BASE_PLAYER_STATS, ECONOMY, BIOME_BY_FLOOR } from '@dungeon/content';
import { EMPTY_RUN_METRICS, EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import { SeededRNG } from '../utils/rng.js';
import { handleCommand } from './command-handler.js';
import { generateFloor } from '../generation/map-generator.js';
import type { ObjectInstance } from '@dungeon/contracts';
import { populateFloor } from '../generation/floor-populator.js';
import { validateSpawns } from '../generation/spawn-validator.js';
import { computeFov } from '../systems/fov.js';
import { createInitialWorldState } from '../state/world-state.js';
import { buildWorldModifiers } from '../systems/world-modifiers.js';
import { executeRetreat } from '../systems/retreat.js';
import { applyRunConsequences } from '../systems/world-consequences.js';
import { simulatePersistedFloorTimeElapsed } from '../systems/enemy-respawn.js';

/** D1: Check and complete quests that require reaching a specific floor depth */
function completeFloorDepthQuests(
  state: GameState,
  _newDepth: number, // eslint-disable-line @typescript-eslint/no-unused-vars
): { state: GameState; events: DomainEvent[] } {
  // D1: Check for quests that require reaching this floor depth
  // TODO: Implement quest targetFloorDepth in Quest type (requires contracts update)
  // For now, skip this logic - will be implemented in Phase D
  return { state, events: [] };
}

export class GameEngine implements IGameEngine {
  createNewGame(seed?: number): GameState {
    // eslint-disable-next-line no-restricted-syntax -- seed entry point, generate with high-quality entropy
    const gameSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
    const gameId = entityId(generateId());
    const playerId = entityId(generateId());
    const rng = new SeededRNG(gameSeed);

    const state: GameState = {
      gameId,
      phase: 'town',
      player: {
        id: playerId,
        name: 'Adventurer',
        level: 1,
        experience: 0,
        stats: { ...BASE_PLAYER_STATS },
        baseStats: { ...BASE_PLAYER_STATS },
        position: { x: 0, y: 0 },
        equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
        inventory: [],
        statuses: [],
        abilities: [],
        gold: ECONOMY.startingGold,
        floor: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalRuns: 0,
        deathStash: null,
      },
      run: null,
      world: createInitialWorldState(rng),
      itemRegistry: { items: new Map() },
      seed: gameSeed,
      turnNumber: 0,
      version: 1,
      activeQuests: [],
    };

    return state;
  }

  submitCommand(state: GameState, command: GameCommand): CommandResult {
    const rng = new SeededRNG(state.seed + state.turnNumber);

    // Special handling: enter dungeon generates a new floor
    if (command.type === 'TOWN_ACTION' && command.action === 'enter_dungeon') {
      return this.enterDungeon(state, rng, command.startDepth);
    }

    // Special handling: ascend command
    if (command.type === 'ASCEND' && state.run) {
      return this.ascendFloor(state, [], rng);
    }

    // Special handling: descend/ascend stairs on move
    if (command.type === 'MOVE' && state.run) {
      const result = handleCommand(state, command, rng);
      if (result.state.run && !result.runEnded) {
        const playerKey = posKey(result.state.player.position);
        const cell = result.state.run.floor.cells.get(playerKey);
        if (cell?.tile.type === 'stairs_down') {
          return this.descendFloor(result.state, rng, result.events);
        }
        if (cell?.tile.type === 'stairs_up' && result.state.run!.floorHistory.length > 0) {
          // Auto-ascend only when there's a prior floor to return to.
          // On floor 1 (no history), stairs_up is the entrance — use RETREAT to leave.
          return this.ascendFloor(result.state, result.events, rng);
        }
      }
      return this.applyConsequencesIfRunEnded(result);
    }

    const result = handleCommand(state, command, rng);
    return this.applyConsequencesIfRunEnded(result);
  }

  /**
   * If a run has ended, apply world consequences (town state deltas, faction ticks, event chains).
   * This ensures consequences are always applied by the engine, regardless of server-side handling.
   */
  private applyConsequencesIfRunEnded(result: CommandResult): CommandResult {
    if (result.runEnded !== true || result.state.run === null) {
      return result;
    }

    const runMetrics = result.state.run.runMetrics;
    if (runMetrics === undefined) {
      return result;
    }
    const consequenceResult = applyRunConsequences(result.state, runMetrics);
    return {
      state: consequenceResult.state,
      events: [...result.events, ...consequenceResult.events],
      runEnded: result.runEnded,
    };
  }

  private enterDungeon(state: GameState, rng: SeededRNG, startDepth?: number): CommandResult {
    // Area 4b: Clamp startDepth to [1, deepestFloor - 1]
    const maxAllowed = Math.max(1, state.world.deepestFloor - 1);

    // If no depth specified, continue from last retreat floor if available
    const defaultDepth = state.lastRetreatFloor !== undefined ? Math.max(1, Math.min(state.lastRetreatFloor, maxAllowed)) : 1;
    const depth = startDepth !== undefined ? Math.max(1, Math.min(startDepth, maxAllowed)) : defaultDepth;
    
    // Phase A2: Check if this floor is already cached from a previous run
    const cachedFloor = state.persistedFloorCache?.get(depth);
    let events: DomainEvent[] = [];

    let floor: DungeonFloor;
    let enemies: ReadonlyMap<string, EnemyInstance>;
    let objects: ReadonlyMap<string, ObjectInstance>;

    if (cachedFloor !== undefined) {
      // Restore cached floor and simulate time elapsed for respawning
      const biome = BIOME_BY_FLOOR(depth, rng);
      const turnsSinceVisit = state.turnNumber - (cachedFloor.lastSimulatedTurn ?? 0);

      // Simulate respawning and ambient behavior based on time elapsed
      const simulatedFloor = simulatePersistedFloorTimeElapsed(
        cachedFloor,
        turnsSinceVisit,
        biome,
        depth,
        rng,
      );

      floor = simulatedFloor.floor;
      enemies = simulatedFloor.enemies;
      objects = simulatedFloor.objects;

      // Update FOV from entrance (cached floor doesn't have updated visibility)
      const visibleCells = computeFov(floor, floor.entrance);
      floor = { ...floor, cells: visibleCells };
    } else {
      // Generate fresh floor
      const biome = BIOME_BY_FLOOR(depth, rng);
      const { floor: generatedFloor } = generateFloor(depth, biome, rng);
      const worldMods = buildWorldModifiers(state.world, depth);
      const { enemies: genEnemies, objects: genObjects } = populateFloor(generatedFloor, biome, rng, worldMods);

      // Validate spawns and fix if needed
      const validation = validateSpawns(generatedFloor, genEnemies);
      const finalEnemies = validation.valid === true ? genEnemies : fixSpawns(generatedFloor, genEnemies);

      // Update FOV from entrance
      const visibleCells = computeFov(generatedFloor, generatedFloor.entrance);

      floor = { ...generatedFloor, cells: visibleCells };
      enemies = finalEnemies;
      objects = genObjects;
    }

    const runId = entityId(generateId());

    events = [...events, {
      type: 'RUN_STARTED',
      runId,
      timestamp: Date.now(),
      turnNumber: state.turnNumber,
    }];

    events = [...events, {
      type: 'PHASE_CHANGED',
      from: 'town',
      to: 'dungeon',
      timestamp: Date.now(),
      turnNumber: state.turnNumber,
    }];

    events = [...events, {
      type: 'FLOOR_ENTERED',
      depth,
      biomeId: floor.biomeId,
      timestamp: Date.now(),
      turnNumber: state.turnNumber,
    }];

    // Initialize speed accumulators for each enemy (for kiting system)
    const speedAccumulators: Record<string, number> = {};
    for (const enemy of enemies.values()) {
      speedAccumulators[enemy.id] = 0;
    }

    let newState: GameState = {
      ...state,
      phase: 'dungeon',
      player: {
        ...state.player,
        position: floor.entrance,
        floor: depth,
      },
      run: {
        runId,
        floor,
        enemies,
        objects,
        turnCount: 0,
        isActive: true,
        runMetrics: EMPTY_RUN_METRICS,
        floorHistory: [],
        floorCache: new Map(),
        weaponMastery: EMPTY_WEAPON_MASTERY,
        speedAccumulators,
      },
      lastRunMetrics: undefined,  // Clear previous run metrics when starting new run
      turnNumber: state.turnNumber + 1,
    };

    // Check for death stash recovery
    const recovery = this.tryRecoverDeathStash(newState, depth);
    if (recovery !== null) {
      newState = recovery.state;
      events = [...events, ...recovery.events];
    }

    // D1: Check for floor depth quest completion
    const questResult = completeFloorDepthQuests(newState, depth);
    newState = questResult.state;
    events = [...events, ...questResult.events];

    return { state: newState, events, runEnded: false };
  }

  private descendFloor(
    state: GameState,
    rng: SeededRNG,
    previousEvents: readonly DomainEvent[],
  ): CommandResult {
    const newDepth = (state.run?.floor.depth ?? 0) + 1;
    const biome = BIOME_BY_FLOOR(newDepth, rng);
    let events = [...previousEvents];

    // Save current floor to history (capped at 3)
    const snapshot: StoredFloor = {
      floor: state.run!.floor,
      enemies: state.run!.enemies,
      objects: state.run!.objects,
      playerPosition: state.player.position,
    };
    const newHistory = [...state.run!.floorHistory, snapshot].slice(-3);

    const existingCache = state.run!.floorCache ?? new Map<number, StoredFloor>();
    const cached = existingCache.get(newDepth);

    let fovFloor: DungeonFloor;
    let finalEnemies: ReadonlyMap<string, EnemyInstance>;
    let objects: ReadonlyMap<string, ObjectInstance>;
    let playerPosition: Position;

    if (cached !== undefined) {
      const restoredCells = computeFov(cached.floor, cached.floor.entrance);
      fovFloor = { ...cached.floor, cells: restoredCells };
      finalEnemies = cached.enemies;
      objects = cached.objects;
      playerPosition = cached.floor.entrance;
    } else {
      const { floor } = generateFloor(newDepth, biome, rng);
      const worldMods = buildWorldModifiers(state.world, newDepth);
      const { enemies: generatedEnemies, objects: generatedObjects } = populateFloor(floor, biome, rng, worldMods);
      const validation = validateSpawns(floor, generatedEnemies);
      finalEnemies = validation.valid === true ? generatedEnemies : fixSpawns(floor, generatedEnemies);
      const visibleCells = computeFov(floor, floor.entrance);
      fovFloor = { ...floor, cells: visibleCells };
      objects = generatedObjects;
      playerPosition = floor.entrance;
    }

    events = [...events, {
      type: 'FLOOR_ENTERED',
      depth: newDepth,
      biomeId: biome.biomeId,
      timestamp: Date.now(),
      turnNumber: state.turnNumber,
    }];

    // Initialize speed accumulators for each new enemy (for kiting system)
    const speedAccumulators: Record<string, number> = {};
    for (const enemy of finalEnemies.values()) {
      speedAccumulators[enemy.id] = 0;
    }

    let newState: GameState = {
      ...state,
      player: {
        ...state.player,
        position: playerPosition,
        floor: newDepth,
      },
      run: {
        ...state.run!,
        floor: fovFloor,
        enemies: finalEnemies,
        objects,
        turnCount: 0,
        floorHistory: newHistory,
        floorCache: existingCache,
        speedAccumulators,
      },
      world: {
        ...state.world,
        deepestFloor: Math.max(state.world.deepestFloor, newDepth),
      },
    };

    // Check for death stash recovery
    const recovery = this.tryRecoverDeathStash(newState, newDepth);
    if (recovery !== null) {
      newState = recovery.state;
      events = [...events, ...recovery.events];
    }

    // D1: Check for floor depth quest completion
    const questResult = completeFloorDepthQuests(newState, newDepth);
    newState = questResult.state;
    events = [...events, ...questResult.events];

    return { state: newState, events, runEnded: false };
  }

  private ascendFloor(
    state: GameState,
    previousEvents: readonly DomainEvent[],
    rng: SeededRNG,
  ): CommandResult {
    if (state.run === null) return { state, events: [...previousEvents], runEnded: false };

    const history = state.run.floorHistory;
    let events = [...previousEvents];

    // If no history (floor 1), treat as retreat to town
    if (history.length === 0) {
      const retreatResult = executeRetreat(state, rng);
      return { state: retreatResult.state, events: [...events, ...retreatResult.events], runEnded: true };
    }

    const prev = history[history.length - 1]!;
    const newHistory = history.slice(0, -1);
    const currentDepth = state.run.floor.depth;
    const newDepth = currentDepth - 1;
    const biome = BIOME_BY_FLOOR(newDepth, rng);

    // Save current floor to cache so re-descending restores the cleared state
    const cacheSnapshot: StoredFloor = {
      floor: state.run.floor,
      enemies: state.run.enemies,
      objects: state.run.objects,
      playerPosition: state.player.position,
    };
    const newCache = new Map(state.run.floorCache ?? []);
    newCache.set(currentDepth, cacheSnapshot);

    // Recompute FOV for the restored floor from player's prior position
    const restoredCells = computeFov(prev.floor, prev.playerPosition);
    const restoredFloor = { ...prev.floor, cells: restoredCells };

    events = [...events, {
      type: 'FLOOR_ENTERED',
      depth: newDepth,
      biomeId: biome.biomeId,
      timestamp: Date.now(),
      turnNumber: state.turnNumber,
    }];

    const newState: GameState = {
      ...state,
      player: {
        ...state.player,
        position: prev.playerPosition,
        floor: newDepth,
      },
      run: {
        ...state.run,
        floor: restoredFloor,
        enemies: prev.enemies,
        objects: prev.objects,
        turnCount: 0,
        floorHistory: newHistory,
        floorCache: newCache,
      },
    };

    // D1: Check for floor depth quest completion
    const questResult = completeFloorDepthQuests(newState, newDepth);
    const finalState = questResult.state;
    events = [...events, ...questResult.events];

    return { state: finalState, events, runEnded: false };
  }

  private tryRecoverDeathStash(
    state: GameState,
    floorDepth: number,
  ): { state: GameState; events: DomainEvent[] } | null {
    const stash = state.player.deathStash;
    if (!stash || stash.floor !== floorDepth) return null;

    let events: DomainEvent[] = [];
    const newRegistry = new Map(state.itemRegistry.items);
    let newInventory = [...state.player.inventory];

    for (const stashItem of stash.items) {
      newRegistry.set(stashItem.entityId, stashItem.item);
      newInventory = [...newInventory, stashItem.entityId];
    }

    events = [...events, {
      type: 'EQUIPMENT_RECOVERED',
      items: stash.items.map(si => ({ slot: si.slot, itemName: si.item.name })),
      floor: floorDepth,
      timestamp: Date.now(),
      turnNumber: state.turnNumber,
    }];

    const newState: GameState = {
      ...state,
      player: {
        ...state.player,
        inventory: newInventory,
        deathStash: null,
      },
      itemRegistry: { items: newRegistry },
    };

    return { state: newState, events };
  }
}

/** Remove enemies that violate spawn rules */
function fixSpawns(
  floor: DungeonFloor,
  enemies: ReadonlyMap<string, EnemyInstance>,
): ReadonlyMap<string, EnemyInstance> {
  const fixed = new Map(enemies);
  const entranceKey = posKey(floor.entrance);
  const exitKey = posKey(floor.exit);

  fixed.delete(entranceKey);
  fixed.delete(exitKey);

  for (const [key, enemy] of fixed) {
    const dist = chebyshevDistance(floor.entrance, enemy.position);
    if (dist <= 2) {
      fixed.delete(key);
    }
  }

  return fixed;
}
