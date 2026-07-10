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

interface PathSearchState {
  readonly queue: readonly PathPosition[];
  readonly visited: ReadonlySet<string>;
  readonly parent: ReadonlyMap<string, string>;
}

function buildPath(
  parent: ReadonlyMap<string, string>,
  startKey: string,
  key: string,
): PathPosition[] {
  if (key === startKey) return [];

  const previousKey = parent.get(key);
  if (previousKey === undefined) return [];

  const [x, y] = key.split(',').map(Number);
  return [
    ...buildPath(parent, startKey, previousKey),
    { x: x!, y: y! },
  ];
}

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

  let searchState: PathSearchState = {
    queue: [from],
    visited: new Set<string>([startKey]),
    parent: new Map<string, string>(),
  };

  while (searchState.queue.length > 0) {
    const [current, ...remainingQueue] = searchState.queue;
    if (current === undefined) return [];
    const currentKey = toKey(current);

    if (currentKey === goalKey) {
      return buildPath(searchState.parent, startKey, goalKey);
    }

    searchState = NEIGHBORS.reduce<PathSearchState>((nextState, { dx, dy }) => {
      const next: PathPosition = { x: current.x + dx, y: current.y + dy };
      const nextKey = toKey(next);

      if (nextState.visited.has(nextKey)) return nextState;
      if (!walkable.has(nextKey)) return nextState;
      if (blocked.has(nextKey) && nextKey !== goalKey) return nextState;

      return {
        queue: [...nextState.queue, next],
        visited: new Set([...nextState.visited, nextKey]),
        parent: new Map([...nextState.parent, [nextKey, currentKey]]),
      };
    }, {
      ...searchState,
      queue: remainingQueue,
    });
  }

  return [];
}
