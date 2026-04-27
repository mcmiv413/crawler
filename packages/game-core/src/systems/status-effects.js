import { posKey } from '@dungeon/contracts';
import { STATUS_DEFAULTS } from '@dungeon/content';
import { applyDamageToPlayer, applyDamageToEnemy, createDamageDebugEvent } from './damage.js';
/** Map status IDs that deal damage to their damage types */
function statusToDamageType(statusId) {
    const map = {
        poison: 'poison',
        burn: 'fire',
        bleed: 'physical',
        slow: null,
        stun: null,
        weaken: null,
        vulnerability: null,
        strength: null,
        regeneration: null,
    };
    return map[statusId] ?? null;
}
function applyStatusEffect(entity, statusId, duration, magnitude, sourceId) {
    // Don't stack — refresh duration instead
    const existing = entity.statuses.find(s => s.id === statusId);
    if (existing !== undefined) {
        return {
            ...entity,
            statuses: entity.statuses.map(s => s.id === statusId
                ? { ...s, turnsRemaining: Math.max(s.turnsRemaining, duration), magnitude: Math.max(s.magnitude, magnitude) }
                : s),
        };
    }
    const effect = { id: statusId, turnsRemaining: duration, magnitude, sourceId };
    return { ...entity, statuses: [...entity.statuses, effect] };
}
/** Apply a new status effect to the player */
export function applyStatusToPlayer(player, statusId, duration, magnitude, sourceId) {
    return applyStatusEffect(player, statusId, duration, magnitude, sourceId);
}
/** Apply a status to an enemy */
export function applyStatusToEnemy(enemy, statusId, duration, magnitude, sourceId) {
    return applyStatusEffect(enemy, statusId, duration, magnitude, sourceId);
}
/** Tick all status effects on the player, returning updated player + events */
export function tickPlayerStatuses(state, turnNumber) {
    let currentState = state;
    let allEvents = [];
    // Apply damage from damaging statuses via central damage system
    for (const status of state.player.statuses) {
        const defaults = STATUS_DEFAULTS[status.id];
        if ('damagePerTurn' in defaults) {
            const damageAmount = defaults.damagePerTurn;
            const damageType = statusToDamageType(status.id);
            // DoT only applies resistance, not defense
            const damageResult = applyDamageToPlayer(currentState, {
                amount: damageAmount,
                damageType: damageType ?? 'physical',
                source: 'dot',
                bypassDefense: true,
                bypassResistance: false,
            });
            currentState = damageResult.state;
            // Add debug event if debug mode enabled
            if (currentState.debugMode === true) {
                const debugEvent = createDamageDebugEvent(currentState.player.name, damageResult, 'dot');
                if (debugEvent !== null) {
                    allEvents = [...allEvents, { ...debugEvent, turnNumber }];
                }
            }
        }
        if ('healPerTurn' in defaults) {
            const healAmount = defaults.healPerTurn;
            currentState = {
                ...currentState,
                player: {
                    ...currentState.player,
                    stats: {
                        ...currentState.player.stats,
                        health: Math.min(currentState.player.stats.maxHealth, currentState.player.stats.health + healAmount),
                    },
                },
            };
        }
    }
    // Decrement durations, remove expired
    let remaining = [];
    for (const status of state.player.statuses) {
        const newDuration = status.turnsRemaining - 1;
        if (newDuration <= 0) {
            allEvents = [...allEvents, {
                    type: 'STATUS_EXPIRED',
                    targetId: state.player.id,
                    statusId: status.id,
                    timestamp: Date.now(),
                    turnNumber,
                }];
        }
        else {
            remaining = [...remaining, { ...status, turnsRemaining: newDuration }];
        }
    }
    return {
        state: {
            ...currentState,
            player: { ...currentState.player, statuses: remaining },
        },
        events: allEvents,
    };
}
/** Get effective stat value considering active statuses */
export function getEffectiveStat(baseStat, statName, statuses) {
    let value = baseStat;
    for (const status of statuses) {
        const defaults = STATUS_DEFAULTS[status.id];
        if (statName === 'attack' && status.id === 'strength') {
            // Strength buff adds its magnitude to attack (additive boost)
            value += status.magnitude;
        }
        if (statName === 'speed' && status.id === 'slow') {
            value = Math.round(value * defaults.speedMultiplier);
        }
        if (statName === 'attack' && status.id === 'weaken') {
            value = Math.round(value * defaults.attackMultiplier);
        }
        if (statName === 'defense' && status.id === 'vulnerability') {
            value = Math.round(value * defaults.defenseMultiplier);
        }
        // Future-proof: accuracy can be modified by status effects (currently none, but extensible)
        if (statName === 'accuracy') {
            // Placeholder for accuracy-modifying statuses
        }
    }
    return value;
}
/** Tick all status effects on an enemy, returning updated state + events */
export function tickEnemyStatuses(state, enemy, turnNumber) {
    let currentState = state;
    let allEvents = [];
    // Cache initial statuses before any state updates
    const initialStatuses = enemy.statuses;
    // Apply damage from damaging statuses via central damage system
    for (const status of initialStatuses) {
        const defaults = STATUS_DEFAULTS[status.id];
        if ('damagePerTurn' in defaults) {
            const damageAmount = defaults.damagePerTurn;
            const damageType = statusToDamageType(status.id);
            // DoT only applies resistance, not defense
            const damageResult = applyDamageToEnemy(currentState, enemy.id, {
                amount: damageAmount,
                damageType: damageType ?? 'physical',
                source: 'dot',
                bypassDefense: true,
                bypassResistance: false,
            });
            currentState = damageResult.state;
            // Add debug event if debug mode enabled
            if (currentState.debugMode === true) {
                const debugEvent = createDamageDebugEvent(enemy.name, damageResult, 'dot');
                if (debugEvent !== null) {
                    allEvents = [...allEvents, { ...debugEvent, turnNumber }];
                }
            }
        }
        if ('healPerTurn' in defaults) {
            const healAmount = defaults.healPerTurn;
            const updatedEnemy = currentState.run?.enemies.get(`${enemy.id}`);
            if (updatedEnemy !== undefined) {
                const newEnemies = new Map(currentState.run.enemies);
                newEnemies.set(`${enemy.id}`, {
                    ...updatedEnemy,
                    stats: {
                        ...updatedEnemy.stats,
                        health: Math.min(updatedEnemy.stats.maxHealth, updatedEnemy.stats.health + healAmount),
                    },
                });
                currentState = { ...currentState, run: { ...currentState.run, enemies: newEnemies } };
            }
        }
    }
    // Decrement durations, remove expired
    let remaining = [];
    for (const status of initialStatuses) {
        const newDuration = status.turnsRemaining - 1;
        if (newDuration <= 0) {
            allEvents = [...allEvents, {
                    type: 'STATUS_EXPIRED',
                    targetId: enemy.id,
                    statusId: status.id,
                    timestamp: Date.now(),
                    turnNumber,
                }];
        }
        else {
            remaining = [...remaining, { ...status, turnsRemaining: newDuration }];
        }
    }
    // Update the enemy's statuses in the state (enemies are keyed by position)
    const enemyKey = posKey(enemy.position);
    const finalEnemy = currentState.run?.enemies.get(enemyKey);
    if (finalEnemy !== undefined && currentState.run !== null) {
        const newEnemies = new Map(currentState.run.enemies);
        newEnemies.set(enemyKey, { ...finalEnemy, statuses: remaining });
        currentState = { ...currentState, run: { ...currentState.run, enemies: newEnemies } };
    }
    return {
        state: currentState,
        events: allEvents,
    };
}
/** Check if entity has a specific status */
export function hasStatus(statuses, statusId) {
    return statuses.some(s => s.id === statusId);
}
//# sourceMappingURL=status-effects.js.map