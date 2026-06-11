export interface PathPosition {
  readonly x: number;
  readonly y: number;
}

export interface PathMapViewRef {
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

export function findPath(
  map: PathMapViewRef,
  from: PathPosition,
  to: PathPosition,
): PathPosition[] {
  if (from.x === to.x && from.y === to.y) return [];

  const walkable = new Set<string>();
  for (const cell of map.cells) {
    if (cell.visibility !== 'hidden' && cell.walkable) {
      walkable.add(`${cell.x},${cell.y}`);
    }
  }

  const blocked = new Set<string>();
  for (const entity of map.entities) {
    if (entity.type === 'enemy') {
      blocked.add(`${entity.x},${entity.y}`);
    }
  }

  const toKey = (p: PathPosition): string => `${p.x},${p.y}`;
  const startKey = toKey(from);
  const goalKey = toKey(to);

  if (!walkable.has(goalKey)) return [];

  const visited = new Set<string>([startKey]);
  const parent = new Map<string, string>();
  const mutableQueue: PathPosition[] = [from];

  while (mutableQueue.length > 0) {
    const current = mutableQueue.shift()!;
    const currentKey = toKey(current);

    if (currentKey === goalKey) {
      const mutablePath: PathPosition[] = [];
      let key = goalKey;
      while (key !== startKey) {
        const [x, y] = key.split(',').map(Number);
        mutablePath.unshift({ x: x!, y: y! });
        key = parent.get(key)!;
      }
      return mutablePath;
    }

    for (const { dx, dy } of NEIGHBORS) {
      const next: PathPosition = { x: current.x + dx, y: current.y + dy };
      const nextKey = toKey(next);

      if (visited.has(nextKey)) continue;
      if (!walkable.has(nextKey)) continue;
      if (blocked.has(nextKey) && nextKey !== goalKey) continue;

      visited.add(nextKey);
      parent.set(nextKey, currentKey);
      mutableQueue.push(next);
    }
  }

  return [];
}
