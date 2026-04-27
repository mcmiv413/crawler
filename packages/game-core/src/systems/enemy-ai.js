import { posKey } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';
import { isWalkable } from './movement.js';
import { Path } from 'rot-js';
import { ARCHETYPES, aggressiveMelee, skittishRanged, cautiousDefensive, hazardCreator, ambusher } from '@dungeon/content';
import { scoreEnemyActions } from './enemy-ai-engine.js';
import { SeededRNG } from '../utils/rng.js';
/** Determine an enemy's action based on archetype behavior */
export function decideEnemyAction(enemy, state) {
    const playerPos = state.player.position;
    const dist = chebyshevDistance(enemy.position, playerPos);
    // If not alerted, check if player is in detection range
    if (enemy.isAlerted !== true) {
        // Default trigger distance is 5, ambushers at 2
        const triggerDist = enemy.archetype === ambusher.id ? 2 : 5;
        if (dist <= triggerDist) {
            // Should become alerted — handled by caller
            return computeApproach(enemy, playerPos, state);
        }
        return { type: 'wait', enemyId: enemy.id };
    }
    // Alerted but out of detection range: pursue last known position
    if (dist > 5 && enemy.lastKnownPlayerPos) {
        return computeApproach(enemy, enemy.lastKnownPlayerPos, state);
    }
    // Load archetype definition and use scoring engine
    let archetypeId = enemy.archetype;
    // Backward compatibility: map old archetype names to new ones
    const archetypeMap = {
        'melee_bruiser': aggressiveMelee.id,
        'fast_skirmisher': skittishRanged.id,
        'ranged_attacker': skittishRanged.id,
        'support_buffer': cautiousDefensive.id,
        'hazard_creator': hazardCreator.id,
        'elite': aggressiveMelee.id,
        'boss': aggressiveMelee.id,
    };
    if (!ARCHETYPES.has(archetypeId)) {
        const mapped = archetypeMap[archetypeId];
        if (mapped !== undefined) {
            archetypeId = mapped;
        }
    }
    const archetypeDef = ARCHETYPES.get(archetypeId);
    if (archetypeDef === undefined) {
        // Fallback if archetype not found - use default aggressive behavior
        return dist <= 1
            ? { type: 'attack', enemyId: enemy.id }
            : computeApproach(enemy, playerPos, state);
    }
    const rng = new SeededRNG(state.run?.floor.seed ?? 42);
    const trace = scoreEnemyActions(enemy, archetypeDef, state, rng);
    return trace.chosen.action;
}
function computeApproach(enemy, target, state) {
    if (state.run === null)
        return { type: 'wait', enemyId: enemy.id };
    const floor = state.run.floor;
    let nextStep = null;
    const astar = new Path.AStar(target.x, target.y, (x, y) => {
        const key = posKey({ x, y });
        const cell = floor.cells.get(key);
        if (!cell || !cell.tile.walkable)
            return false;
        // Allow the target position (player) and own position
        if (x === target.x && y === target.y)
            return true;
        if (x === enemy.position.x && y === enemy.position.y)
            return true;
        return isWalkable(state, { x, y });
    }, { topology: 8 });
    let path = [];
    astar.compute(enemy.position.x, enemy.position.y, (x, y) => {
        path = [...path, { x, y }];
    });
    // path[0] is the start, path[1] is the next step
    if (path.length >= 2) {
        nextStep = path[1];
    }
    if (nextStep !== null) {
        return { type: 'move', enemyId: enemy.id, targetPosition: nextStep };
    }
    return { type: 'wait', enemyId: enemy.id };
}
//# sourceMappingURL=enemy-ai.js.map