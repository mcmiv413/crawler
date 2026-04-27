import { posKey } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';
import { bfsReachable } from './map-generator.js';
/** Validate spawns on a populated floor (SRD §13: no unfair spawns) */
export function validateSpawns(floor, enemies) {
    let issues = [];
    // Rule 1: No enemies on entrance tile
    const entranceKey = posKey(floor.entrance);
    if (enemies.has(entranceKey)) {
        issues = [...issues, 'Enemy spawned on entrance tile'];
    }
    // Rule 2: No enemies within 2 tiles of entrance (unfair spawn-kill)
    let proximityIssues = [];
    for (const enemy of enemies.values()) {
        const dist = chebyshevDistance(floor.entrance, enemy.position);
        if (dist <= 2) {
            proximityIssues = [...proximityIssues, `Enemy "${enemy.name}" too close to entrance (distance ${dist})`];
        }
    }
    issues = [...issues, ...proximityIssues];
    // Rule 3: Exit must be reachable from entrance
    // (enemies don't block movement for this check — player can fight through)
    if (!bfsReachable(floor.cells, floor.entrance, floor.exit)) {
        issues = [...issues, 'Exit not reachable from entrance'];
    }
    // Rule 4: Enemy count within bounds
    const maxEnemies = 20; // hard cap
    if (enemies.size > maxEnemies) {
        issues = [...issues, `Too many enemies: ${enemies.size} > ${maxEnemies}`];
    }
    // Rule 5: No enemies on exit tile
    const exitKey = posKey(floor.exit);
    if (enemies.has(exitKey)) {
        issues = [...issues, 'Enemy spawned on exit tile'];
    }
    return {
        valid: issues.length === 0,
        issues,
    };
}
//# sourceMappingURL=spawn-validator.js.map