import type {
  CommandResult,
  DomainEvent,
  DungeonFloor,
  EnemyInstance,
  GameState,
  ObjectInstance,
  Position,
  StoredFloor,
  WorldState,
} from '@dungeon/contracts';
import { EMPTY_RUN_METRICS, entityId, posKey } from '@dungeon/contracts';
import { generateId } from '../utils/id.js';
import { generateFloor } from '../generation/map-generator.js';
import { populateFloor } from '../generation/floor-populator.js';
import { validateSpawns } from '../generation/spawn-validator.js';
import { computeFov } from '../systems/fov.js';
import { buildWorldModifiers } from '../systems/world-modifiers.js';
import { applyNewDeepestFloorPressure } from '../systems/factions.js';
import { executeRetreat } from '../systems/retreat.js';
import { simulatePersistedFloorTimeElapsed } from '../systems/enemy-respawn.js';
import { completeFloorDepthQuests } from '../systems/quests.js';
import { selectBiomeForFloor } from '../systems/biome-selection.js';
import { applyGuaranteedEncounters, countGuaranteedEncountersForFloor } from './guaranteed-encounters.js';
import { recoverDeathStash } from './death-stash-recovery.js';
import type { SeededRNG } from '../utils/rng.js';
import { chebyshevDistance } from '../utils/grid.js';

interface PreparedFloor {
  floor: DungeonFloor;
  enemies: ReadonlyMap<string, EnemyInstance>;
  objects: ReadonlyMap<string, ObjectInstance>;
  playerPosition: Position;
}

export function enterDungeon(
  state: GameState,
  rng: SeededRNG,
  startDepth?: number,
): CommandResult {
  const maxAllowed = Math.max(1, state.world.deepestFloor);
  const defaultDepth = state.lastRetreatFloor !== undefined
    ? Math.max(1, Math.min(state.lastRetreatFloor, maxAllowed))
    : 1;
  const depth = startDepth !== undefined
    ? Math.max(1, Math.min(startDepth, maxAllowed))
    : defaultDepth;
  const biome = selectBiomeForFloor(depth, state.world, rng);
  const cachedFloor = state.persistedFloorCache?.get(depth);
  const preparedFloor = cachedFloor !== undefined
    ? restorePersistedFloor(state, cachedFloor, biome, depth, rng)
    : createGeneratedFloor(state, state.world, depth, biome, rng);
  const enemies = applyGuaranteedEncounters(
    state,
    state.world,
    preparedFloor.floor,
    preparedFloor.enemies,
    rng,
  );
  const runId = entityId(generateId());
  const events: DomainEvent[] = [
    {
      type: 'RUN_STARTED',
      runId,
      timestamp: state.turnNumber,
      turnNumber: state.turnNumber,
    },
    {
      type: 'PHASE_CHANGED',
      from: 'town',
      to: 'dungeon',
      timestamp: state.turnNumber,
      turnNumber: state.turnNumber,
    },
    buildFloorEnteredEvent(depth, preparedFloor.floor.biomeId, state.turnNumber),
  ];

  const nextState: GameState = {
    ...state,
    phase: 'dungeon',
    player: {
      ...state.player,
      position: preparedFloor.floor.entrance,
      floor: depth,
    },
    run: {
      runId,
      floor: preparedFloor.floor,
      enemies,
      objects: preparedFloor.objects,
      turnCount: 0,
      isActive: true,
      runMetrics: EMPTY_RUN_METRICS,
      floorHistory: [],
      floorCache: new Map(),
      speedAccumulators: buildSpeedAccumulators(enemies),
    },
    lastRunMetrics: undefined,
    turnNumber: state.turnNumber + 1,
  };

  return finalizeEnteredFloor(nextState, depth, events, true);
}

export function descendFloor(
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
  const cachedFloor = state.persistedFloorCache?.get(newDepth) ?? existingCache.get(newDepth);
  const preparedFloor = cachedFloor !== undefined
    ? restoreVisitedFloor(cachedFloor, cachedFloor.floor.entrance)
    : createGeneratedFloor(state, worldForDepth, newDepth, biome, rng);
  const enemies = applyGuaranteedEncounters(
    state,
    worldForDepth,
    preparedFloor.floor,
    preparedFloor.enemies,
    rng,
  );

  events = [...events, buildFloorEnteredEvent(newDepth, biome.biomeId, state.turnNumber)];

  const nextState: GameState = {
    ...state,
    player: {
      ...state.player,
      position: preparedFloor.playerPosition,
      floor: newDepth,
    },
    run: {
      ...state.run!,
      floor: preparedFloor.floor,
      enemies,
      objects: preparedFloor.objects,
      turnCount: 0,
      floorHistory: newHistory,
      floorCache: existingCache,
      speedAccumulators: buildSpeedAccumulators(enemies),
    },
    world: {
      ...worldForDepth,
      deepestFloor: Math.max(worldForDepth.deepestFloor, newDepth),
    },
  };

  return finalizeEnteredFloor(nextState, newDepth, events, true);
}

export function ascendFloor(
  state: GameState,
  previousEvents: readonly DomainEvent[],
  rng: SeededRNG,
): CommandResult {
  if (state.run === null) {
    return { state, events: [...previousEvents], runEnded: false };
  }

  let events = [...previousEvents];
  if (state.player.floor <= 1) {
    const retreatResult = executeRetreat(state, rng);
    return {
      state: retreatResult.state,
      events: [...events, ...retreatResult.events],
      runEnded: true,
    };
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

  const cachedFloor = state.run.floorHistory[0]
    ?? state.run.floorCache?.get(targetDepth)
    ?? state.persistedFloorCache?.get(targetDepth);
  const preparedFloor = cachedFloor !== undefined
    ? restoreVisitedFloor(cachedFloor, cachedFloor.playerPosition)
    : createGeneratedFloor(state, state.world, targetDepth, biome, rng);
  const enemies = applyGuaranteedEncounters(
    state,
    state.world,
    preparedFloor.floor,
    preparedFloor.enemies,
    rng,
  );

  events = [...events, buildFloorEnteredEvent(targetDepth, biome.biomeId, state.turnNumber)];

  const nextState: GameState = {
    ...state,
    player: {
      ...state.player,
      position: preparedFloor.playerPosition,
      floor: targetDepth,
    },
    run: {
      ...state.run,
      floor: preparedFloor.floor,
      enemies,
      objects: preparedFloor.objects,
      turnCount: 0,
      floorHistory: state.run.floorHistory.slice(0, -1),
      floorCache: newCache,
      speedAccumulators: buildSpeedAccumulators(enemies),
    },
  };

  const questResult = completeFloorDepthQuests(nextState, targetDepth);
  return {
    state: questResult.state,
    events: [...events, ...questResult.events],
    runEnded: false,
  };
}

function buildFloorEnteredEvent(depth: number, biomeId: string, turnNumber: number): DomainEvent {
  return {
    type: 'FLOOR_ENTERED',
    depth,
    biomeId,
    timestamp: turnNumber,
    turnNumber,
  };
}

function buildVisibleFloor(floor: DungeonFloor, position: Position): DungeonFloor {
  return {
    ...floor,
    cells: computeFov(floor, position),
  };
}

function buildSpeedAccumulators(
  enemies: ReadonlyMap<string, EnemyInstance>,
): Record<string, number> {
  const speedAccumulators: Record<string, number> = {};

  for (const enemy of enemies.values()) {
    speedAccumulators[enemy.id] = 0;
  }

  return speedAccumulators;
}

function createGeneratedFloor(
  state: GameState,
  world: WorldState,
  depth: number,
  biome: ReturnType<typeof selectBiomeForFloor>,
  rng: SeededRNG,
): PreparedFloor {
  const { floor } = generateFloor(depth, biome, rng);
  const reservedEncounterSlots = countGuaranteedEncountersForFloor(
    state,
    world,
    depth,
    biome.biomeId,
  );
  const worldMods = buildWorldModifiers(world, depth, reservedEncounterSlots);
  const { enemies: generatedEnemies, objects } = populateFloor(floor, biome, rng, worldMods);
  const validation = validateSpawns(floor, generatedEnemies);
  const enemies = validation.valid === true ? generatedEnemies : fixSpawns(floor, generatedEnemies);

  return {
    floor: buildVisibleFloor(floor, floor.entrance),
    enemies,
    objects,
    playerPosition: floor.entrance,
  };
}

function restorePersistedFloor(
  state: GameState,
  cachedFloor: StoredFloor,
  biome: ReturnType<typeof selectBiomeForFloor>,
  depth: number,
  rng: SeededRNG,
): PreparedFloor {
  const turnsSinceVisit = state.turnNumber - (cachedFloor.lastSimulatedTurn ?? 0);
  const simulatedFloor = simulatePersistedFloorTimeElapsed(
    cachedFloor,
    turnsSinceVisit,
    biome,
    depth,
    rng,
    state.world.factions,
  );

  return {
    floor: buildVisibleFloor(simulatedFloor.floor, simulatedFloor.floor.entrance),
    enemies: simulatedFloor.enemies,
    objects: simulatedFloor.objects,
    playerPosition: simulatedFloor.floor.entrance,
  };
}

function restoreVisitedFloor(
  cachedFloor: StoredFloor,
  playerPosition: Position,
): PreparedFloor {
  return {
    floor: buildVisibleFloor(cachedFloor.floor, playerPosition),
    enemies: cachedFloor.enemies,
    objects: cachedFloor.objects,
    playerPosition,
  };
}

function finalizeEnteredFloor(
  state: GameState,
  depth: number,
  events: readonly DomainEvent[],
  includeDeathStashRecovery: boolean,
): CommandResult {
  let nextState = state;
  let nextEvents = [...events];

  if (includeDeathStashRecovery === true) {
    const recovery = recoverDeathStash(nextState, depth);
    if (recovery !== null) {
      nextState = recovery.state;
      nextEvents = [...nextEvents, ...recovery.events];
    }
  }

  const questResult = completeFloorDepthQuests(nextState, depth);
  nextState = questResult.state;
  nextEvents = [...nextEvents, ...questResult.events];

  return { state: nextState, events: nextEvents, runEnded: false };
}

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
