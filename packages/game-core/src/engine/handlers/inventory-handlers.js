import { updateRunMetrics } from './shared.js';
import { useConsumable } from '../../systems/inventory.js';
import { equipItem, unequipItem, swapWeaponSets } from '../../systems/equipment.js';
import { processEnemyTurns } from '../turn-scheduler.js';
import { tickAbilityCooldowns } from '../../systems/abilities.js';
import { isPlayerThreatened } from '../../systems/threat.js';
export function handleEquip(state, itemId) {
    // Block equip if player is threatened (under immediate attack range)
    if (state.phase === 'dungeon' && isPlayerThreatened(state)) {
        return {
            state,
            events: [{
                    type: 'EQUIP_BLOCKED',
                    reason: 'Cannot change equipment while enemies are in threat range.',
                    timestamp: Date.now(),
                    turnNumber: state.turnNumber,
                }],
            runEnded: false,
        };
    }
    const result = equipItem(state, itemId);
    return { state: result.state, events: result.events, runEnded: false };
}
export function handleUnequip(state, itemId) {
    // Block unequip if player is threatened (under immediate attack range)
    if (state.phase === 'dungeon' && isPlayerThreatened(state)) {
        return {
            state,
            events: [{
                    type: 'EQUIP_BLOCKED',
                    reason: 'Cannot change equipment while enemies are in threat range.',
                    timestamp: Date.now(),
                    turnNumber: state.turnNumber,
                }],
            runEnded: false,
        };
    }
    const result = unequipItem(state, itemId);
    return { state: result.state, events: result.events, runEnded: false };
}
export function handleSwapWeapons(state, rng) {
    if (state.phase === 'dungeon' && state.run) {
        const result = swapWeaponSets(state);
        let newState = result.state;
        let events = [...result.events];
        // Weapon swap is a free action, but still consumes a turn for enemies
        newState = updateRunMetrics(newState, { turnsElapsed: 1 });
        // Enemy turns with player speed for speed-based action accumulation
        const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
        newState = enemyResult.state;
        events = [...events, ...enemyResult.events];
        newState = tickAbilityCooldowns(newState);
        const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
        return { state: newState, events, runEnded };
    }
    const result = swapWeaponSets(state);
    return { state: result.state, events: result.events, runEnded: false };
}
export function handleUseItem(state, itemId, rng, targetId) {
    if (state.phase === 'dungeon' && state.run) {
        const result = useConsumable(state, itemId, targetId);
        let newState = result.state;
        let events = [...result.events];
        newState = updateRunMetrics(newState, { itemsUsed: 1, turnsElapsed: 1 });
        // Enemy turns with player speed for speed-based action accumulation
        const enemyResult = processEnemyTurns(newState, rng, newState.player.stats.speed);
        newState = enemyResult.state;
        events = [...events, ...enemyResult.events];
        newState = tickAbilityCooldowns(newState);
        const runEnded = newState.phase === 'town' || newState.phase === 'game_over';
        return { state: newState, events, runEnded };
    }
    return { state, events: [], runEnded: false };
}
//# sourceMappingURL=inventory-handlers.js.map