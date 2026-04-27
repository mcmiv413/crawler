import { moveInDirection } from '../utils/grid.js';
/**
 * Get valid adjacent directions for trap placement.
 * Returns array of directions that are walkable, not occupied by objects or enemies,
 * and within map bounds.
 */
export function getValidTrapPlacementDirections(state) {
    if (!state.run)
        return [];
    const playerPos = state.player.position;
    const floor = state.run.floor;
    const validDirs = [];
    // All 8 adjacent directions
    const directions = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
    for (const dir of directions) {
        const pos = moveInDirection(playerPos, dir);
        // Check map bounds
        if (pos.x < 0 || pos.x >= floor.width || pos.y < 0 || pos.y >= floor.height) {
            continue;
        }
        // Check if walkable
        const cell = floor.cells.get(`${pos.x},${pos.y}`);
        if (!cell || !cell.tile.walkable) {
            continue;
        }
        // Check if occupied by object
        if (state.run.objects.has(`${pos.x},${pos.y}`)) {
            continue;
        }
        // Check if occupied by enemy
        let hasEnemy = false;
        for (const enemy of state.run.enemies.values()) {
            if (enemy.position.x === pos.x && enemy.position.y === pos.y) {
                hasEnemy = true;
                break;
            }
        }
        if (hasEnemy) {
            continue;
        }
        validDirs.push(pos);
    }
    return validDirs;
}
//# sourceMappingURL=trap-placement.js.map