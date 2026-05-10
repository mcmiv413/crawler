import type { GameState, GameCommand, StoredFloor, DungeonFloor, EnemyInstance, Position, WorldState } from '@dungeon/contracts';
import { entityId, posKey } from '@dungeon/contracts';
import type { IGameEngine, CommandResult } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';
import { generateId } from '../utils/id.js';
import { BASE_PLAYER_STATS, ECONOMY, ENEMY_TEMPLATES, MAX_EVENT_HISTORY, selectBiomeForFloor } from '@dungeon/content';
import { EMPTY_RUN_METRICS, EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import { SeededRNG } from '../utils/rng.js';
import { handleCommand } from './command-handler.js';
import { generateFloor } from '../generation/map-generator.js';
import type { ObjectInstance } from '@dungeon/contracts';
import { populateFloor } from '../generation/floor-populator.js';
import { createEnemyInstance, assignInstanceColors } from '../generation/enemy-instantiation.js';
import { validateSpawns } from '../generation/spawn-validator.js';
import { computeFov } from '../systems/fov.js';
import { createInitialWorldState } from '../state/world-state.js';
import { buildWorldModifiers } from '../systems/world-modifiers.js';
import { applyNewDeepestFloorPressure } from '../systems/factions.js';
import { executeRetreat } from '../systems/retreat.js';
import { applyRunConsequences } from '../systems/world-consequences.js';
import { simulatePersistedFloorTimeElapsed } from '../systems/enemy-respawn.js';
import { completeFloorDepthQuests } from '../systems/quests.js';
import { evaluateAllQuestProgress } from './quest-evaluator.js';

export class GameEngine implements IGameEngine {
  createNewGame(seed: number): GameState {
    const gameId = entityId(generateId());
    const playerId = entityId(generateId());
    const rng = new SeededRNG(seed);

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
      seed,
      turnNumber: 0,
      version: 1,
      activeQuests: [],
      weaponMastery: EMPTY_WEAPON_MASTERY,
    };

    return state;
  }

  submitCommand(state: GameState, command: GameCommand): CommandResult {
    const rng = new SeededRNG(state.seed + state.turnNumber);

    // Special handling: enter dungeon generates a new floor
    if (command.type === 'TOWN_ACTION' && command.action === 'enter_dungeon') {
      return this.finalizeCommandResult(this.enterDungeon(state, rng, command.startDepth), false);
    }

    // Special handling: ascend command
    if (command.type === 'ASCEND' && state.run) {
      return this.finalizeCommandResult(this.ascendFloor(state, [], rng), false);
    }

    // Special handling: descend/ascend stairs on move
    if (command.type === 'MOVE' && state.run) {
      const result = handleCommand(state, command, rng);
      if (result.state.run && !result.runEnded) {
        const playerKey = posKey(result.state.player.position);
        const cell = result.state.run.floor.cells.get(playerKey);
        if (cell?.tile.type === 'stairs_down') {
          return this.finalizeCommandResult(this.descendFloor(result.state, rng, result.events), false);
        }
        if (cell?.tile.type === 'stairs_up' && result.state.run!.floorHistory.length > 0) {
          // Auto-ascend only when there's a prior floor to return to.
          // On floor 1 (no history), stairs_up is the entrance — use RETREAT to leave.
          return this.finalizeCommandResult(this.ascendFloor(result.state, result.events, rng), false);
        }
      }
      return this.finalizeCommandResult(result, false);
    }

    return this.finalizeCommandResult(handleCommand(state, command, rng), true);
  }

  private finalizeCommandResult(
    result: CommandResult,
    evaluateQuestProgress: boolean,
  ): CommandResult {
    const afterConsequences = this.applyConsequencesIfRunEnded(result);

    if (evaluateQuestProgress !== true) {
      return {
        state: this.appendEventHistory(afterConsequences.state, afterConsequences.events),
        events: afterConsequences.events,
        runEnded: afterConsequences.runEnded,
      };
    }

    const questEval = evaluateAllQuestProgress(afterConsequences.state);
    const events = [...afterConsequences.events, ...questEval.events];

    return {
      state: this.appendEventHistory(questEval.state, events),
      events,
      runEnded: afterConsequences.runEnded,
    };
  }

  /**
   * If a run has ended, apply world consequences (town state deltas, faction ticks, event chains).
   * This ensures consequences are always applied by the engine, regardless of server-side handling.
   */
  private applyConsequencesIfRunEnded(result: CommandResult): CommandResult {
    if (result.runEnded !== true) {
      return result;
    }

    const runMetrics = result.state.run?.runMetrics ?? result.state.lastRunMetrics;
    if (runMetrics === undefined) {
      return result;
    }
    const consequenceResult = applyRunConsequences(result.state, runMetrics, result.events);
    return {
      state: consequenceResult.state,
      events: [...result.events, ...consequenceResult.events],
      runEnded: result.runEnded,
    };
  }

  private appendEventHistory(
    state: GameState,
    events: readonly DomainEvent[],
  ): GameState {
    if (events.length === 0) {
      return state;
    }

    const eventHistory = [...state.world.eventHistory, ...events].slice(-MAX_EVENT_HISTORY);

    return {
      ...state,
      world: {
        ...state.world,
        eventHistory,
      },
    };
  }

  private enterDungeon(state: GameState, rng: SeededRNG, startDepth?: number): CommandResult {
    const maxAllowed = Math.max(1, state.world.deepestFloor);
    const defaultDepth = state.lastRetreatFloor !== undefined ? Math.max(1, Math.min(state.lastRetreatFloor, maxAllowed)) : 1;
    const depth = startDepth !== undefined ? Math.max(1, Math.min(startDepth, maxAllowed)) : defaultDepth;

    const biome = selectBiomeForFloor(depth, state.world, rng);
    const cachedFloor = state.persistedFloorCache?.get(depth);
    let events: DomainEvent[] = [];

    let floor: DungeonFloor;
    let enemies: ReadonlyMap<string, EnemyInstance>;
    let objects: ReadonlyMap<string, ObjectInstance>;

    if (cachedFloor !== undefined) {
      const turnsSinceVisit = state.turnNumber - (cachedFloor.lastSimulatedTurn ?? 0);
      const simulatedFloor = simulatePersistedFloorTimeElapsed(
        cachedFloor,
        turnsSinceVisit,
        biome,
        depth,
        rng,
        state.world.factions,
      );

      floor = simulatedFloor.floor;
      enemies = simulatedFloor.enemies;
      objects = simulatedFloor.objects;
      const visibleCells = computeFov(floor, floor.entrance);
      floor = { ...floor, cells: visibleCells };
    } else {
      const { floor: generatedFloor } = generateFloor(depth, biome, rng);
      const reservedEncounterSlots = this.countGuaranteedEncountersForFloor(state, state.world, depth, biome.biomeId);
      const worldMods = buildWorldModifiers(state.world, depth, reservedEncounterSlots);
      const { enemies: genEnemies, objects: genObjects } = populateFloor(generatedFloor, biome, rng, worldMods);
      const validation = validateSpawns(generatedFloor, genEnemies);
      const finalEnemies = validation.valid === true ? genEnemies : fixSpawns(generatedFloor, genEnemies);
      const visibleCells = computeFov(generatedFloor, generatedFloor.entrance);

      floor = { ...generatedFloor, cells: visibleCells };
      enemies = finalEnemies;
      objects = genObjects;
    }

    enemies = this.applyGuaranteedEncounters(state, state.world, floor, enemies, rng);
    const runId = entityId(generateId());

    events = [...events, {
      type: 'RUN_STARTED',
      runId,
      timestamp: state.turnNumber,
      turnNumber: state.turnNumber,
    }];

    events = [...events, {
      type: 'PHASE_CHANGED',
      from: 'town',
      to: 'dungeon',
      timestamp: state.turnNumber,
      turnNumber: state.turnNumber,
    }];

    events = [...events, {
      type: 'FLOOR_ENTERED',
      depth,
      biomeId: floor.biomeId,
      timestamp: state.turnNumber,
      turnNumber: state.turnNumber,
    }];

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
        speedAccumulators,
      },
      lastRunMetrics: undefined,
      turnNumber: state.turnNumber + 1,
    };

    const recovery = this.tryRecoverDeathStash(newState, depth);
    if (recovery !== null) {
      newState = recovery.state;
      events = [...events, ...recovery.events];
    }

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
    let events = [...previousEvents];
    const previousDeepestFloor = state.world.deepestFloor;

    let worldForDepth = state.world;
    if (newDepth > previousDeepestFloor) {
      const pressureResult = applyNewDeepestFloorPressure(
        state.world,
        previousDeepestFloor,
        newDepth,
        { timestamp: state.turnNumber, turnNumber: state.turnNumber, depth: newDepth },
      );
      worldForDepth = pressureResult.world;
      events = [...events, ...pressureResult.events];
    }
    const biome = selectBiomeForFloor(newDepth, worldForDepth, rng);

    const snapshot: StoredFloor = {
      floor: state.run!.floor,
      enemies: state.run!.enemies,
      objects: state.run!.objects,
      playerPosition: state.player.position,
    };
    const newHistory = [...state.run!.floorHistory, snapshot].slice(-3);

    const existingCache = state.run!.floorCache ?? new Map<number, StoredFloor>();
    let cached = state.persistedFloorCache?.get(newDepth);
    if (cached === undefined) {
      cached = existingCache.get(newDepth);
    }

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
      const reservedEncounterSlots = this.countGuaranteedEncountersForFloor(state, worldForDepth, newDepth, biome.biomeId);
      const worldMods = buildWorldModifiers(worldForDepth, newDepth, reservedEncounterSlots);
      const { enemies: generatedEnemies, objects: generatedObjects } = populateFloor(floor, biome, rng, worldMods);
      const validation = validateSpawns(floor, generatedEnemies);
      finalEnemies = validation.valid === true ? generatedEnemies : fixSpawns(floor, generatedEnemies);
      const visibleCells = computeFov(floor, floor.entrance);
      fovFloor = { ...floor, cells: visibleCells };
      objects = generatedObjects;
      playerPosition = floor.entrance;
    }

    finalEnemies = this.applyGuaranteedEncounters(state, worldForDepth, fovFloor, finalEnemies, rng);

    events = [...events, {
      type: 'FLOOR_ENTERED',
      depth: newDepth,
      biomeId: biome.biomeId,
      timestamp: state.turnNumber,
      turnNumber: state.turnNumber,
    }];

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
        ...worldForDepth,
        deepestFloor: Math.max(worldForDepth.deepestFloor, newDepth),
      },
    };

    const recovery = this.tryRecoverDeathStash(newState, newDepth);
    if (recovery !== null) {
      newState = recovery.state;
      events = [...events, ...recovery.events];
    }

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

    let events = [...previousEvents];

    if (state.player.floor <= 1) {
      const retreatResult = executeRetreat(state, rng);
      return { state: retreatResult.state, events: [...events, ...retreatResult.events], runEnded: true };
    }

    const currentDepth = state.run.floor.depth;
    const targetDepth = currentDepth - 1;
    const biome = selectBiomeForFloor(targetDepth, state.world, rng);

    const cacheSnapshot: StoredFloor = {
      floor: state.run.floor,
      enemies: state.run.enemies,
      objects: state.run.objects,
      playerPosition: state.player.position,
    };
    const newCache = new Map(state.run.floorCache ?? []);
    newCache.set(currentDepth, cacheSnapshot);

    const fromHistory = state.run.floorHistory.length > 0 ? state.run.floorHistory[0] : undefined;
    const cached = fromHistory ?? state.run.floorCache?.get(targetDepth) ?? state.persistedFloorCache?.get(targetDepth);

    let restoredFloor: DungeonFloor;
    let restoredEnemies: ReadonlyMap<string, EnemyInstance>;
    let restoredObjects: ReadonlyMap<string, ObjectInstance>;
    let playerPosition: Position;

    if (cached !== undefined) {
      const restoredCells = computeFov(cached.floor, cached.playerPosition);
      restoredFloor = { ...cached.floor, cells: restoredCells };
      restoredEnemies = cached.enemies;
      restoredObjects = cached.objects;
      playerPosition = cached.playerPosition;
    } else {
      const { floor } = generateFloor(targetDepth, biome, rng);
      const reservedEncounterSlots = this.countGuaranteedEncountersForFloor(state, state.world, targetDepth, biome.biomeId);
      const worldMods = buildWorldModifiers(state.world, targetDepth, reservedEncounterSlots);
      const { enemies: genEnemies, objects: genObjects } = populateFloor(floor, biome, rng, worldMods);
      const validation = validateSpawns(floor, genEnemies);
      const finalEnemies = validation.valid === true ? genEnemies : fixSpawns(floor, genEnemies);
      const visibleCells = computeFov(floor, floor.entrance);
      restoredFloor = { ...floor, cells: visibleCells };
      restoredEnemies = finalEnemies;
      restoredObjects = genObjects;
      playerPosition = floor.entrance;
    }

    restoredEnemies = this.applyGuaranteedEncounters(state, state.world, restoredFloor, restoredEnemies, rng);

    events = [...events, {
      type: 'FLOOR_ENTERED',
      depth: targetDepth,
      biomeId: biome.biomeId,
      timestamp: state.turnNumber,
      turnNumber: state.turnNumber,
    }];

    const speedAccumulators: Record<string, number> = {};
    for (const enemy of restoredEnemies.values()) {
      speedAccumulators[enemy.id] = 0;
    }

    const newState: GameState = {
      ...state,
      player: {
        ...state.player,
        position: playerPosition,
        floor: targetDepth,
      },
      run: {
        ...state.run,
        floor: restoredFloor,
        enemies: restoredEnemies,
        objects: restoredObjects,
        turnCount: 0,
        floorHistory: state.run.floorHistory.slice(0, -1),
        floorCache: newCache,
        speedAccumulators,
      },
    };

    const questResult = completeFloorDepthQuests(newState, targetDepth);
    const finalState = questResult.state;
    events = [...events, ...questResult.events];

    return { state: finalState, events, runEnded: false };
  }


  private countGuaranteedEncountersForFloor(
    state: GameState,
    world: WorldState,
    depth: number,
    biomeId: string,
  ): number {
    let count = 0;
    for (const faction of world.factions) {
      const leader = faction.leader;
      if (faction.status !== 'led' || leader === null || leader.isActive !== true) {
        continue;
      }
      if (this.isEntityPresentAnywhere(state, leader.id) || !this.isTemplateEligibleForFloor(leader.templateId, depth, biomeId)) {
        continue;
      }
      count += 1;
    }

    if (world.dungeonOgre.status === 'emerged'
      && world.dungeonOgre.selectedSpawnDepth === depth
      && this.isEntityPresentAnywhere(state, entityId('dungeon_ogre')) !== true) {
      count += 1;
    }

    return count;
  }

  private applyGuaranteedEncounters(
    state: GameState,
    world: WorldState,
    floor: DungeonFloor,
    enemies: ReadonlyMap<string, EnemyInstance>,
    rng: SeededRNG,
  ): ReadonlyMap<string, EnemyInstance> {
    let updatedEnemies = new Map(enemies);

    for (const faction of world.factions) {
      const leader = faction.leader;
      if (faction.status !== 'led' || leader === null || leader.isActive !== true) {
        continue;
      }
      if ([...updatedEnemies.values()].some(enemy => enemy.id === leader.id) || this.isEntityPresentAnywhere(state, leader.id)) {
        continue;
      }
      if (!this.isTemplateEligibleForFloor(leader.templateId, floor.depth, floor.biomeId)) {
        continue;
      }

      const template = ENEMY_TEMPLATES.get(leader.templateId);
      const position = this.findGuaranteedEncounterPosition(floor, updatedEnemies, rng);
      if (template === undefined || position === null) {
        continue;
      }

      this.removeOccupantAtPosition(updatedEnemies, position);
      updatedEnemies.set(posKey(position), createEnemyInstance(template, position, floor.depth, {
        id: leader.id,
        name: `${leader.name} ${leader.title}`,
        skipFactionStrength: true,
      }));
    }

    if (world.dungeonOgre.status === 'emerged'
      && world.dungeonOgre.selectedSpawnDepth === floor.depth
      && ![...updatedEnemies.values()].some(enemy => enemy.id === entityId('dungeon_ogre'))
      && this.isEntityPresentAnywhere(state, entityId('dungeon_ogre')) !== true) {
      const template = ENEMY_TEMPLATES.get('dungeon_ogre');
      const position = this.findGuaranteedEncounterPosition(floor, updatedEnemies, rng);
      if (template !== undefined && position !== null) {
        this.removeOccupantAtPosition(updatedEnemies, position);
        updatedEnemies.set(posKey(position), createEnemyInstance(template, position, floor.depth, {
          id: entityId('dungeon_ogre'),
          skipFactionStrength: true,
        }));
      }
    }

    return assignInstanceColors(updatedEnemies);
  }

  private findGuaranteedEncounterPosition(
    floor: DungeonFloor,
    enemies: ReadonlyMap<string, EnemyInstance>,
    rng: SeededRNG,
  ): Position | null {
    const candidates = Array.from(floor.cells)
      .filter(([key, cell]) => {
        if (cell.tile.walkable !== true) return false;
        const [x, y] = key.split(',').map(Number);
        const position = { x: x!, y: y! };
        if (key === posKey(floor.entrance) || key === posKey(floor.exit)) return false;
        return chebyshevDistance(position, floor.entrance) > 2;
      })
      .map(([key]) => {
        const [x, y] = key.split(',').map(Number);
        return { x: x!, y: y! };
      });

    const openPositions = candidates.filter(position => !enemies.has(posKey(position)));
    if (openPositions.length > 0) {
      return rng.pick(openPositions);
    }

    if (candidates.length === 0) {
      return null;
    }

    const mutableCandidates = [...candidates];
    mutableCandidates.sort((left, right) =>
      chebyshevDistance(right, floor.entrance) - chebyshevDistance(left, floor.entrance));
    return mutableCandidates[0] ?? null;
  }

  private removeOccupantAtPosition(enemies: Map<string, EnemyInstance>, position: Position): void {
    enemies.delete(posKey(position));
  }

  private isTemplateEligibleForFloor(templateId: string, depth: number, biomeId: string): boolean {
    const template = ENEMY_TEMPLATES.get(templateId);
    if (template === undefined) {
      return false;
    }
    const [minDepth, maxDepth] = template.spawn.floorRange;
    if (depth < minDepth || depth > maxDepth) {
      return false;
    }
    return template.biomes?.some(biome => biome.biomeId === biomeId) ?? true;
  }

  private isEntityPresentAnywhere(state: GameState, entityIdToFind: ReturnType<typeof entityId>): boolean {
    if (state.run?.enemies && [...state.run.enemies.values()].some(enemy => enemy.id === entityIdToFind)) {
      return true;
    }
    for (const floor of state.run?.floorCache?.values() ?? []) {
      if ([...floor.enemies.values()].some(enemy => enemy.id === entityIdToFind)) {
        return true;
      }
    }
    for (const floor of state.persistedFloorCache?.values() ?? []) {
      if ([...floor.enemies.values()].some(enemy => enemy.id === entityIdToFind)) {
        return true;
      }
    }
    return false;
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
      timestamp: state.turnNumber,
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
