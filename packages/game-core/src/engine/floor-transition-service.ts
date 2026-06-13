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
import { BIOME_DEFINITIONS } from '@dungeon/content';
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
import { withActiveFloorPersisted, withPersistedFloor } from '../state/floor-cache.js';
import type { SeededRNG } from '../utils/rng.js';
import { chebyshevDistance } from '../utils/grid.js';

interface PreparedFloor {
  floor: DungeonFloor;
  enemies: ReadonlyMap<string, EnemyInstance>;
  objects: ReadonlyMap<string, ObjectInstance>;
  playerPosition: Position;
  storeOnEnter: boolean;
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
  const preparedFloor = getOrRestoreFloor(state, state.world, depth, rng, 'enter');
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

  return finalizeEnteredFloor(
    withEnteredFloorPersisted(nextState, preparedFloor, depth),
    depth,
    events,
    true,
  );
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

  const stateWithCurrentFloorPersisted = withCurrentFloorPersisted(state);
  const preparedFloor = getOrRestoreFloor(stateWithCurrentFloorPersisted, worldForDepth, newDepth, rng, 'descend');
  const enemies = applyGuaranteedEncounters(
    stateWithCurrentFloorPersisted,
    worldForDepth,
    preparedFloor.floor,
    preparedFloor.enemies,
    rng,
  );

  events = [...events, buildFloorEnteredEvent(newDepth, preparedFloor.floor.biomeId, state.turnNumber)];

  const nextState: GameState = {
    ...stateWithCurrentFloorPersisted,
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
      floorHistory: [],
      floorCache: new Map(),
      speedAccumulators: buildSpeedAccumulators(enemies),
    },
    world: {
      ...worldForDepth,
      deepestFloor: Math.max(worldForDepth.deepestFloor, newDepth),
    },
  };

  return finalizeEnteredFloor(
    withEnteredFloorPersisted(nextState, preparedFloor, newDepth),
    newDepth,
    events,
    true,
  );
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
  const stateWithCurrentFloorPersisted = withCurrentFloorPersisted(state);
  const preparedFloor = getOrRestoreFloor(stateWithCurrentFloorPersisted, state.world, targetDepth, rng, 'ascend');
  const enemies = applyGuaranteedEncounters(
    stateWithCurrentFloorPersisted,
    state.world,
    preparedFloor.floor,
    preparedFloor.enemies,
    rng,
  );

  events = [...events, buildFloorEnteredEvent(targetDepth, preparedFloor.floor.biomeId, state.turnNumber)];

  const nextState: GameState = {
    ...stateWithCurrentFloorPersisted,
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
      floorHistory: [],
      floorCache: new Map(),
      speedAccumulators: buildSpeedAccumulators(enemies),
    },
  };

  const questResult = completeFloorDepthQuests(nextState, targetDepth);
  return {
    state: withEnteredFloorPersisted(questResult.state, preparedFloor, targetDepth),
    events: [...events, ...questResult.events],
    runEnded: false,
  };
}

function withCurrentFloorPersisted(state: GameState): GameState {
  return withActiveFloorPersisted(state, {
    originalEnemyCount: state.run?.enemies.size,
    lastSimulatedTurn: state.turnNumber,
  });
}

function withEnteredFloorPersisted(
  state: GameState,
  preparedFloor: PreparedFloor,
  depth: number,
): GameState {
  if (preparedFloor.storeOnEnter !== true) return state;

  return withPersistedFloor(state, depth, {
    floor: preparedFloor.floor,
    enemies: preparedFloor.enemies,
    objects: preparedFloor.objects,
    playerPosition: preparedFloor.playerPosition,
    originalEnemyCount: preparedFloor.enemies.size,
    lastSimulatedTurn: state.turnNumber,
  });
}

function getOrRestoreFloor(
  state: GameState,
  world: WorldState,
  depth: number,
  rng: SeededRNG,
  direction: 'enter' | 'descend' | 'ascend',
): PreparedFloor {
  const selectedBiome = selectBiomeForFloor(depth, world, rng);
  const cachedFloor = getCachedFloorForDepth(state, depth);
  if (cachedFloor !== undefined) {
    const biome = BIOME_DEFINITIONS.get(cachedFloor.floor.biomeId) ?? selectedBiome;
    if (direction === 'enter') {
      return restorePersistedFloor(state, cachedFloor, biome, depth, rng);
    }

    const playerPosition = direction === 'descend'
      ? cachedFloor.floor.entrance
      : cachedFloor.playerPosition;
    return restoreVisitedFloor(cachedFloor, playerPosition);
  }

  return createGeneratedFloor(state, world, depth, selectedBiome, rng);
}

function getCachedFloorForDepth(state: GameState, depth: number): StoredFloor | undefined {
  const cachedFloor = state.persistedFloorCache?.get(depth);
  if (cachedFloor?.floor.depth === depth) {
    return cachedFloor;
  }

  return undefined;
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
    storeOnEnter: true,
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
    storeOnEnter: false,
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
    storeOnEnter: false,
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
