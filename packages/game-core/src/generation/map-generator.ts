import { Map as RotMap, RNG as RotRNG } from 'rot-js';
import type { DungeonFloor, MapCell, Position, Tile } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { MAP_GENERATION } from '@dungeon/content';
import type { BiomeDefinition } from '@dungeon/content';
import type { SeededRNG } from '../utils/rng.js';

const FLOOR_TILE: Tile = { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#aaa' };
const WALL_TILE: Tile = { type: 'wall', walkable: false, blocksVision: true, ascii: '#', color: '#666' };
const DOOR_TILE: Tile = { type: 'door', walkable: true, blocksVision: false, ascii: '+', color: '#964B00' };
const STAIRS_DOWN: Tile = { type: 'stairs_down', walkable: true, blocksVision: false, ascii: '>', color: '#ff0' };
const STAIRS_UP: Tile = { type: 'stairs_up', walkable: true, blocksVision: false, ascii: '<', color: '#0ff' };
const MAX_ROT_SEED = 0x7fffffff;

export interface GeneratedFloor {
  readonly floor: DungeonFloor;
  readonly valid: boolean;
}

/** Generate a dungeon floor using rot.js Digger or Cellular automata */
export function generateFloor(
  depth: number,
  biome: BiomeDefinition,
  rng: SeededRNG,
): GeneratedFloor {
  // Use cellular automata for biomes that opt in (organic layouts)
  if (biome.mapGen?.algorithm === 'cellular') {
    return attemptCellularGeneration(depth, biome, rng);
  }

  // Default: room-based generation (Digger with Uniform fallback)
  for (let attempt = 0; attempt < MAP_GENERATION.maxRetries; attempt++) {
    const result = attemptGeneration(depth, biome, rng);
    if (result.valid === true) return result;
  }

  // Final attempt — use Uniform which guarantees connectivity
  return attemptUniformGeneration(depth, biome, rng);
}

function attemptGeneration(
  depth: number,
  biome: BiomeDefinition,
  rng: SeededRNG,
): GeneratedFloor {
  const width = rng.int(MAP_GENERATION.minWidth, MAP_GENERATION.maxWidth);
  const height = rng.int(MAP_GENERATION.minHeight, MAP_GENERATION.maxHeight);
  const floorSeed = nextFloorSeed(rng);
  const cells = new Map<string, MapCell>();
  let floorPositions: Position[] = [];

  const mg = biome.mapGen;
  withRotSeed(floorSeed, () => {
    const digger = new RotMap.Digger(width, height, {
      roomWidth: (mg !== undefined ? [...mg.roomWidth] : [3, 7]) as [number, number],
      roomHeight: (mg !== undefined ? [...mg.roomHeight] : [3, 5]) as [number, number],
      corridorLength: (mg !== undefined ? [...mg.corridorLength] : [1, 5]) as [number, number],
      dugPercentage: Math.min(0.7, Math.max(0.3, mg?.dugPercentage ?? 0.45)),
    });

    digger.create((x, y, value) => {
      const pos = { x, y };
      const key = posKey(pos);
      if (value === 0) {
        cells.set(key, { tile: FLOOR_TILE, visibility: 'hidden' });
        floorPositions = [...floorPositions, pos];
      } else {
        cells.set(key, { tile: WALL_TILE, visibility: 'hidden' });
      }
    });

    for (const room of digger.getRooms()) {
      room.getDoors((x, y) => {
        const key = posKey({ x, y });
        cells.set(key, { tile: DOOR_TILE, visibility: 'hidden' });
      });
    }
  });

  if (floorPositions.length < 20) {
    return { floor: emptyFloor(depth, biome, floorSeed), valid: false };
  }

  // Pick entrance and exit from floor positions
  const entrance = floorPositions[0]!;
  const exit = floorPositions[floorPositions.length - 1]!;

  // Place stairs
  cells.set(posKey(entrance), { tile: STAIRS_UP, visibility: 'hidden' });
  cells.set(posKey(exit), { tile: STAIRS_DOWN, visibility: 'hidden' });

  // BFS validation: entrance must reach exit
  const valid = bfsReachable(cells, entrance, exit);

  const floor: DungeonFloor = {
    width,
    height,
    depth,
    biomeId: biome.biomeId,
    cells,
    entrance,
    exit,
    seed: floorSeed,
  };

  return { floor, valid };
}

function attemptUniformGeneration(
  depth: number,
  biome: BiomeDefinition,
  rng: SeededRNG,
): GeneratedFloor {
  const width = rng.int(MAP_GENERATION.minWidth, MAP_GENERATION.maxWidth);
  const height = rng.int(MAP_GENERATION.minHeight, MAP_GENERATION.maxHeight);
  const floorSeed = nextFloorSeed(rng);
  const cells = new Map<string, MapCell>();
  let floorPositions: Position[] = [];

  const mg = biome.mapGen;
  withRotSeed(floorSeed, () => {
    const uniform = new RotMap.Uniform(width, height, {
      roomWidth: (mg !== undefined ? [...mg.roomWidth] : [3, 7]) as [number, number],
      roomHeight: (mg !== undefined ? [...mg.roomHeight] : [3, 5]) as [number, number],
      roomDugPercentage: Math.min(0.7, Math.max(0.3, mg?.dugPercentage ?? 0.35)),
    });

    uniform.create((x, y, value) => {
      const pos = { x, y };
      const key = posKey(pos);
      if (value === 0) {
        cells.set(key, { tile: FLOOR_TILE, visibility: 'hidden' });
        floorPositions = [...floorPositions, pos];
      } else {
        cells.set(key, { tile: WALL_TILE, visibility: 'hidden' });
      }
    });

    for (const room of uniform.getRooms()) {
      room.getDoors((x, y) => {
        const key = posKey({ x, y });
        cells.set(key, { tile: DOOR_TILE, visibility: 'hidden' });
      });
    }
  });

  const entrance = floorPositions[0] ?? { x: 1, y: 1 };
  const exit = floorPositions[floorPositions.length - 1] ?? { x: width - 2, y: height - 2 };

  cells.set(posKey(entrance), { tile: STAIRS_UP, visibility: 'hidden' });
  cells.set(posKey(exit), { tile: STAIRS_DOWN, visibility: 'hidden' });

  const floor: DungeonFloor = {
    width,
    height,
    depth,
    biomeId: biome.biomeId,
    cells,
    entrance,
    exit,
    seed: floorSeed,
  };

  return { floor, valid: bfsReachable(cells, entrance, exit) };
}

/** BFS to check entrance-exit connectivity */
export function bfsReachable(
  cells: ReadonlyMap<string, MapCell>,
  start: Position,
  end: Position,
): boolean {
  const visited = new Set<string>();
  let queue: Position[] = [start];
  visited.add(posKey(start));

  const targetKey = posKey(end);

  while (queue.length > 0) {
    const current = queue[0]!;
    queue = queue.slice(1);
    const currentKey = posKey(current);

    if (currentKey === targetKey) return true;

    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]] as [number, number][]) {
      const next: Position = { x: current.x + dx, y: current.y + dy };
      const nextKey = posKey(next);
      if (visited.has(nextKey)) continue;

      const cell = cells.get(nextKey);
      if (cell && cell.tile.walkable) {
        visited.add(nextKey);
        queue = [...queue, next];
      }
    }
  }

  return false;
}

function attemptCellularGeneration(
  depth: number,
  biome: BiomeDefinition,
  rng: SeededRNG,
): GeneratedFloor {
  const width = rng.int(MAP_GENERATION.minWidth, MAP_GENERATION.maxWidth);
  const height = rng.int(MAP_GENERATION.minHeight, MAP_GENERATION.maxHeight);
  const floorSeed = nextFloorSeed(rng);

  const fillProbability = biome.mapGen?.fillProbability ?? 0.48;
  const iterations = biome.mapGen?.iterations ?? 4;

  const cells = new Map<string, MapCell>();
  let floorPositions: Position[] = [];
  withRotSeed(floorSeed, () => {
    const cellular = new RotMap.Cellular(width, height);
    cellular.randomize(fillProbability);

    for (let i = 0; i < iterations; i++) {
      cellular.create();
    }

    cellular.connect(
      (x, y, value) => {
        const pos = { x, y };
        const key = posKey(pos);
        if (value === 0) {
          cells.set(key, { tile: FLOOR_TILE, visibility: 'hidden' });
          floorPositions = [...floorPositions, pos];
        } else {
          cells.set(key, { tile: WALL_TILE, visibility: 'hidden' });
        }
      },
      0,
    );
  });

  if (floorPositions.length < 20) {
    return { floor: emptyFloor(depth, biome, floorSeed), valid: false };
  }

  // Pick entrance and exit from floor positions
  const entrance = floorPositions[0]!;
  const exit = floorPositions[floorPositions.length - 1]!;

  // Place stairs
  cells.set(posKey(entrance), { tile: STAIRS_UP, visibility: 'hidden' });
  cells.set(posKey(exit), { tile: STAIRS_DOWN, visibility: 'hidden' });

  // Verify connectivity
  const valid = bfsReachable(cells, entrance, exit);

  const floor: DungeonFloor = {
    width,
    height,
    depth,
    biomeId: biome.biomeId,
    cells,
    entrance,
    exit,
    seed: floorSeed,
  };

  return { floor, valid };
}

function emptyFloor(depth: number, biome: BiomeDefinition, floorSeed: number): DungeonFloor {
  return {
    width: 10,
    height: 10,
    depth,
    biomeId: biome.biomeId,
    cells: new Map(),
    entrance: { x: 1, y: 1 },
    exit: { x: 8, y: 8 },
    seed: floorSeed,
  };
}

function nextFloorSeed(rng: SeededRNG): number {
  return rng.int(1, MAX_ROT_SEED);
}

function withRotSeed<T>(seed: number, factory: () => T): T {
  const previousState = RotRNG.getState();
  RotRNG.setSeed(seed);
  try {
    return factory();
  } finally {
    RotRNG.setState(previousState);
  }
}
