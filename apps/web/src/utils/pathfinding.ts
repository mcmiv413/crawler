/**
 * Pathfinding utility: A* implementation for dungeon navigation.
 * Considers walkability and enemy positions but allows bumping into enemies.
 */

interface Position {
  readonly x: number;
  readonly y: number;
}

interface MapViewRef {
  readonly cells: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly visibility: string;
    readonly walkable: boolean;
  }>;
  readonly entities: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly type: string;
  }>;
}

const NEIGHBORS = [
  { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
  { dx: 1, dy: -1 }, { dx: -1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
];

export function findPath(map: MapViewRef, from: Position, to: Position): Position[] {
  if (from.x === to.x && from.y === to.y) return [];

  // Build walkability lookup from visible + remembered cells
  const walkable = new Set<string>();
  for (const cell of map.cells) {
    if (cell.visibility !== 'hidden' && cell.walkable) {
      walkable.add(`${cell.x},${cell.y}`);
    }
  }

  // Mark enemy-occupied cells as blocked
  const blocked = new Set<string>();
  for (const entity of map.entities) {
    if (entity.type === 'enemy') {
      blocked.add(`${entity.x},${entity.y}`);
    }
  }

  const toKey = (p: Position) => `${p.x},${p.y}`;
  const startKey = toKey(from);
  const goalKey = toKey(to);

  // Destination must be walkable (but can be enemy-occupied for bump-to-attack)
  if (!walkable.has(goalKey)) return [];

  const visited = new Set<string>([startKey]);
  const parent = new Map<string, string>();
  const queue: Position[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = toKey(current);

    if (currentKey === goalKey) {
      // Reconstruct path
      const path: Position[] = [];
      let key = goalKey;
      while (key !== startKey) {
        const [x, y] = key.split(',').map(Number);
        path.unshift({ x: x!, y: y! });
        key = parent.get(key)!;
      }
      return path;
    }

    for (const { dx, dy } of NEIGHBORS) {
      const next: Position = { x: current.x + dx, y: current.y + dy };
      const nextKey = toKey(next);

      if (visited.has(nextKey)) continue;
      if (!walkable.has(nextKey)) continue;
      // Allow moving to the goal even if enemy is there (for bump-to-attack)
      if (blocked.has(nextKey) && nextKey !== goalKey) continue;

      visited.add(nextKey);
      parent.set(nextKey, currentKey);
      queue.push(next);
    }
  }

  return [];
}
