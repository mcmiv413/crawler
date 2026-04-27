const NEIGHBORS = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 1, dy: -1 }, { dx: -1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
];
export function findPath(map, from, to) {
    if (from.x === to.x && from.y === to.y)
        return [];
    // Build walkability lookup from visible + remembered cells
    const walkable = new Set();
    for (const cell of map.cells) {
        if (cell.visibility !== 'hidden' && cell.walkable) {
            walkable.add(`${cell.x},${cell.y}`);
        }
    }
    // Mark enemy-occupied cells as blocked
    const blocked = new Set();
    for (const entity of map.entities) {
        if (entity.type === 'enemy') {
            blocked.add(`${entity.x},${entity.y}`);
        }
    }
    const toKey = (p) => `${p.x},${p.y}`;
    const startKey = toKey(from);
    const goalKey = toKey(to);
    // Destination must be walkable (but can be enemy-occupied for bump-to-attack)
    if (!walkable.has(goalKey))
        return [];
    const visited = new Set([startKey]);
    const parent = new Map();
    let queue = [from];
    while (queue.length > 0) {
        const current = queue[0];
        queue = queue.slice(1);
        const currentKey = toKey(current);
        if (currentKey === goalKey) {
            // Reconstruct path
            let path = [];
            let key = goalKey;
            while (key !== startKey) {
                const [x, y] = key.split(',').map(Number);
                path = [{ x: x, y: y }, ...path];
                key = parent.get(key);
            }
            return path;
        }
        for (const { dx, dy } of NEIGHBORS) {
            const next = { x: current.x + dx, y: current.y + dy };
            const nextKey = toKey(next);
            if (visited.has(nextKey))
                continue;
            if (!walkable.has(nextKey))
                continue;
            // Allow moving to the goal even if enemy is there (for bump-to-attack)
            if (blocked.has(nextKey) && nextKey !== goalKey)
                continue;
            visited.add(nextKey);
            parent.set(nextKey, currentKey);
            queue = [...queue, next];
        }
    }
    return [];
}
//# sourceMappingURL=pathfinding.js.map