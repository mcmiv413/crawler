import { Map as RotMap } from 'rot-js';
import { posKey } from '@dungeon/contracts';
import { MAP_GENERATION } from '@dungeon/content';
const FLOOR_TILE = { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#aaa' };
const WALL_TILE = { type: 'wall', walkable: false, blocksVision: true, ascii: '#', color: '#666' };
const DOOR_TILE = { type: 'door', walkable: true, blocksVision: false, ascii: '+', color: '#964B00' };
const STAIRS_DOWN = { type: 'stairs_down', walkable: true, blocksVision: false, ascii: '>', color: '#ff0' };
const STAIRS_UP = { type: 'stairs_up', walkable: true, blocksVision: false, ascii: '<', color: '#0ff' };
/** Generate a dungeon floor using rot.js Digger or Cellular automata */
export function generateFloor(depth, biome, rng) {
    // Use cellular automata for biomes that opt in (organic layouts)
    if (biome.mapGen?.algorithm === 'cellular') {
        return attemptCellularGeneration(depth, biome, rng);
    }
    // Default: room-based generation (Digger with Uniform fallback)
    for (let attempt = 0; attempt < MAP_GENERATION.maxRetries; attempt++) {
        const result = attemptGeneration(depth, biome, rng);
        if (result.valid === true)
            return result;
    }
    // Final attempt — use Uniform which guarantees connectivity
    return attemptUniformGeneration(depth, biome, rng);
}
function attemptGeneration(depth, biome, rng) {
    const width = rng.int(MAP_GENERATION.minWidth, MAP_GENERATION.maxWidth);
    const height = rng.int(MAP_GENERATION.minHeight, MAP_GENERATION.maxHeight);
    const cells = new Map();
    let floorPositions = [];
    const mg = biome.mapGen;
    const digger = new RotMap.Digger(width, height, {
        roomWidth: (mg !== undefined ? [...mg.roomWidth] : [3, 7]),
        roomHeight: (mg !== undefined ? [...mg.roomHeight] : [3, 5]),
        corridorLength: (mg !== undefined ? [...mg.corridorLength] : [1, 5]),
        dugPercentage: Math.min(0.7, Math.max(0.3, mg?.dugPercentage ?? 0.45)),
    });
    digger.create((x, y, value) => {
        const pos = { x, y };
        const key = posKey(pos);
        if (value === 0) {
            // Floor
            cells.set(key, { tile: FLOOR_TILE, visibility: 'hidden' });
            floorPositions = [...floorPositions, pos];
        }
        else {
            // Wall
            cells.set(key, { tile: WALL_TILE, visibility: 'hidden' });
        }
    });
    // Place doors at room connections
    const rooms = digger.getRooms();
    for (const room of rooms) {
        room.getDoors((x, y) => {
            const key = posKey({ x, y });
            cells.set(key, { tile: DOOR_TILE, visibility: 'hidden' });
        });
    }
    if (floorPositions.length < 20) {
        return { floor: emptyFloor(depth, biome, rng), valid: false };
    }
    // Pick entrance and exit from floor positions
    const entrance = floorPositions[0];
    const exit = floorPositions[floorPositions.length - 1];
    // Place stairs
    cells.set(posKey(entrance), { tile: STAIRS_UP, visibility: 'hidden' });
    cells.set(posKey(exit), { tile: STAIRS_DOWN, visibility: 'hidden' });
    // BFS validation: entrance must reach exit
    const valid = bfsReachable(cells, entrance, exit);
    const floor = {
        width,
        height,
        depth,
        biomeId: biome.biomeId,
        cells,
        entrance,
        exit,
        seed: rng.getSeed(),
    };
    return { floor, valid };
}
function attemptUniformGeneration(depth, biome, rng) {
    const width = rng.int(MAP_GENERATION.minWidth, MAP_GENERATION.maxWidth);
    const height = rng.int(MAP_GENERATION.minHeight, MAP_GENERATION.maxHeight);
    const cells = new Map();
    let floorPositions = [];
    const mg = biome.mapGen;
    const uniform = new RotMap.Uniform(width, height, {
        roomWidth: (mg !== undefined ? [...mg.roomWidth] : [3, 7]),
        roomHeight: (mg !== undefined ? [...mg.roomHeight] : [3, 5]),
        roomDugPercentage: Math.min(0.7, Math.max(0.3, mg?.dugPercentage ?? 0.35)),
    });
    uniform.create((x, y, value) => {
        const pos = { x, y };
        const key = posKey(pos);
        if (value === 0) {
            cells.set(key, { tile: FLOOR_TILE, visibility: 'hidden' });
            floorPositions = [...floorPositions, pos];
        }
        else {
            cells.set(key, { tile: WALL_TILE, visibility: 'hidden' });
        }
    });
    const rooms = uniform.getRooms();
    for (const room of rooms) {
        room.getDoors((x, y) => {
            const key = posKey({ x, y });
            cells.set(key, { tile: DOOR_TILE, visibility: 'hidden' });
        });
    }
    const entrance = floorPositions[0] ?? { x: 1, y: 1 };
    const exit = floorPositions[floorPositions.length - 1] ?? { x: width - 2, y: height - 2 };
    cells.set(posKey(entrance), { tile: STAIRS_UP, visibility: 'hidden' });
    cells.set(posKey(exit), { tile: STAIRS_DOWN, visibility: 'hidden' });
    const floor = {
        width,
        height,
        depth,
        biomeId: biome.biomeId,
        cells,
        entrance,
        exit,
        seed: rng.getSeed(),
    };
    return { floor, valid: bfsReachable(cells, entrance, exit) };
}
/** BFS to check entrance-exit connectivity */
export function bfsReachable(cells, start, end) {
    const visited = new Set();
    let queue = [start];
    visited.add(posKey(start));
    const targetKey = posKey(end);
    while (queue.length > 0) {
        const current = queue[0];
        queue = queue.slice(1);
        const currentKey = posKey(current);
        if (currentKey === targetKey)
            return true;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            const next = { x: current.x + dx, y: current.y + dy };
            const nextKey = posKey(next);
            if (visited.has(nextKey))
                continue;
            const cell = cells.get(nextKey);
            if (cell && cell.tile.walkable) {
                visited.add(nextKey);
                queue = [...queue, next];
            }
        }
    }
    return false;
}
function attemptCellularGeneration(depth, biome, rng) {
    const width = rng.int(MAP_GENERATION.minWidth, MAP_GENERATION.maxWidth);
    const height = rng.int(MAP_GENERATION.minHeight, MAP_GENERATION.maxHeight);
    const fillProbability = biome.mapGen?.fillProbability ?? 0.48;
    const iterations = biome.mapGen?.iterations ?? 4;
    // Create cellular automata with default rules (born: [5,6,7,8], survive: [4,5,6,7,8])
    const cellular = new RotMap.Cellular(width, height);
    cellular.randomize(fillProbability);
    // Run automata iterations to create organic structures
    for (let i = 0; i < iterations; i++) {
        cellular.create();
    }
    const cells = new Map();
    let floorPositions = [];
    // Use connect() to carve tunnels between disconnected regions
    // Callback value: 0 = floor (open space), 1 = wall
    cellular.connect((x, y, value) => {
        const pos = { x, y };
        const key = posKey(pos);
        if (value === 0) {
            cells.set(key, { tile: FLOOR_TILE, visibility: 'hidden' });
            floorPositions = [...floorPositions, pos];
        }
        else {
            cells.set(key, { tile: WALL_TILE, visibility: 'hidden' });
        }
    }, 0);
    if (floorPositions.length < 20) {
        return { floor: emptyFloor(depth, biome, rng), valid: false };
    }
    // Pick entrance and exit from floor positions
    const entrance = floorPositions[0];
    const exit = floorPositions[floorPositions.length - 1];
    // Place stairs
    cells.set(posKey(entrance), { tile: STAIRS_UP, visibility: 'hidden' });
    cells.set(posKey(exit), { tile: STAIRS_DOWN, visibility: 'hidden' });
    // Verify connectivity
    const valid = bfsReachable(cells, entrance, exit);
    const floor = {
        width,
        height,
        depth,
        biomeId: biome.biomeId,
        cells,
        entrance,
        exit,
        seed: rng.getSeed(),
    };
    return { floor, valid };
}
function emptyFloor(depth, biome, rng) {
    return {
        width: 10,
        height: 10,
        depth,
        biomeId: biome.biomeId,
        cells: new Map(),
        entrance: { x: 1, y: 1 },
        exit: { x: 8, y: 8 },
        seed: rng.getSeed(),
    };
}
//# sourceMappingURL=map-generator.js.map