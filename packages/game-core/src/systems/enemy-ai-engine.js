import { chebyshevDistance } from '../utils/grid.js';
import { decideMovementByBehavior } from './movement-behaviors.js';
/**
 * Score all feasible enemy actions given an archetype definition.
 * Returns ranked list of candidates + trace data for logging.
 */
export function scoreEnemyActions(enemy, archetypeDef, gameState, _rng) {
    // Generate feasible actions (move, attack, ability, wait)
    const feasible = generateFeasibleActions(enemy, gameState, archetypeDef);
    // Score each candidate
    const mutableCandidates = [];
    for (const action of feasible) {
        const scores = {};
        let totalScore = 0;
        // Apply action selection rules (condition-based weights)
        for (const rule of archetypeDef.actionSelection) {
            if (evaluateCondition(rule.condition, enemy, gameState)) {
                if (rule.actions.includes(action.type)) {
                    totalScore += rule.weight;
                    scores[`action_${action.type}`] = rule.weight;
                }
            }
        }
        mutableCandidates.push({
            action,
            scores,
            totalScore,
            reasoning: buildReasoning(action, scores, totalScore),
        });
    }
    // Sort by score descending, pick best
    mutableCandidates.sort((a, b) => b.totalScore - a.totalScore);
    const chosen = mutableCandidates[0] ?? {
        action: { type: 'wait', enemyId: enemy.id },
        scores: {},
        totalScore: 0,
        reasoning: 'No actions available, waiting.',
    };
    return {
        enemyId: enemy.id,
        turn: gameState.run?.turnCount ?? 0,
        candidates: mutableCandidates,
        chosen,
    };
}
function generateFeasibleActions(enemy, gameState, _archetypeDef) {
    if (gameState.run === null)
        return [];
    const playerPos = gameState.player.position;
    const dist = chebyshevDistance(enemy.position, playerPos);
    const floor = gameState.run.floor;
    const mutableActions = [];
    // Move actions: behavior-based if assigned, otherwise approach or retreat
    if (enemy.movementBehaviorId !== undefined) {
        // Use behavior-based movement
        const behaviorMoveTarget = decideMovementByBehavior(enemy, gameState);
        if (behaviorMoveTarget !== null) {
            mutableActions.push({
                type: 'move',
                enemyId: enemy.id,
                targetPosition: behaviorMoveTarget,
            });
        }
    }
    else {
        // Default approach/retreat logic
        if (dist > 1) {
            // Approach: move one step closer
            const dx = Math.sign(playerPos.x - enemy.position.x);
            const dy = Math.sign(playerPos.y - enemy.position.y);
            const nextPos = { x: enemy.position.x + dx, y: enemy.position.y + dy };
            const nextKey = `${nextPos.x},${nextPos.y}`;
            const nextCell = floor.cells.get(nextKey);
            if (nextCell !== undefined && nextCell.tile.walkable === true) {
                mutableActions.push({
                    type: 'move',
                    enemyId: enemy.id,
                    targetPosition: nextPos,
                });
            }
        }
        else if (dist === 1) {
            // Adjacent: also try retreat moves (move away from player)
            const dx = Math.sign(enemy.position.x - playerPos.x);
            const dy = Math.sign(enemy.position.y - playerPos.y);
            const retreatPos = { x: enemy.position.x + dx, y: enemy.position.y + dy };
            const retreatKey = `${retreatPos.x},${retreatPos.y}`;
            const retreatCell = floor.cells.get(retreatKey);
            if (retreatCell !== undefined && retreatCell.tile.walkable === true) {
                mutableActions.push({
                    type: 'move',
                    enemyId: enemy.id,
                    targetPosition: retreatPos,
                });
            }
        }
    }
    // Attack if within weapon range (melee or ranged)
    const weaponRange = enemy.equipment.weapon.weaponRange;
    if (dist <= weaponRange) {
        mutableActions.push({ type: 'attack', enemyId: enemy.id });
    }
    // Abilities from archetype preferences
    if (enemy.abilities !== undefined && enemy.abilities.length > 0) {
        for (const abilityId of enemy.abilities) {
            const cooldown = enemy.abilityCooldowns?.[abilityId] ?? 0;
            if (cooldown === 0) {
                mutableActions.push({
                    type: 'ability',
                    enemyId: enemy.id,
                    abilityId,
                });
            }
        }
    }
    // Wait (always feasible)
    mutableActions.push({ type: 'wait', enemyId: enemy.id });
    return mutableActions;
}
/**
 * Evaluate a condition string against the current game state.
 * Conditions like: 'playerAdjacent', 'playerRange2to5', 'hpBelowThreshold(0.5)', etc.
 */
function evaluateCondition(condition, enemy, gameState) {
    if (condition === undefined || condition === '')
        return true; // No condition = always applies
    const dist = chebyshevDistance(enemy.position, gameState.player.position);
    const hpPercent = enemy.stats.health / enemy.stats.maxHealth;
    if (condition === 'playerAdjacent')
        return dist === 1;
    if (condition === 'playerRange2to5')
        return dist >= 2 && dist <= 5;
    if (condition === 'playerRange6Plus')
        return dist >= 6;
    if (condition === 'playerNotAlerted')
        return enemy.isAlerted !== true;
    if (condition === 'selfHpLow')
        return hpPercent < 0.3;
    // Parse threshold conditions like 'hpBelowThreshold(0.5)'
    const thresholdMatch = condition.match(/hpBelowThreshold\(([\d.]+)\)/);
    if (thresholdMatch !== null) {
        const threshold = parseFloat(thresholdMatch[1]);
        return hpPercent < threshold;
    }
    const aboveThresholdMatch = condition.match(/hpAboveThreshold\(([\d.]+)\)/);
    if (aboveThresholdMatch !== null) {
        const threshold = parseFloat(aboveThresholdMatch[1]);
        return hpPercent > threshold;
    }
    // Unknown condition defaults to true
    return true;
}
function buildReasoning(action, scores, totalScore) {
    const actionDesc = getActionDescription(action);
    const scoreStr = Object.entries(scores)
        .map(([k, v]) => `${k}=${v.toFixed(1)}`)
        .join(', ');
    const scoreDetail = scoreStr !== '' ? `, ${scoreStr}` : '';
    return `${actionDesc} (score: ${totalScore.toFixed(1)}${scoreDetail})`;
}
function getActionDescription(action) {
    switch (action.type) {
        case 'move': return 'move';
        case 'attack': return 'attack';
        case 'ability': return 'ability';
        case 'wait': return 'wait';
        default: return 'unknown';
    }
}
//# sourceMappingURL=enemy-ai-engine.js.map