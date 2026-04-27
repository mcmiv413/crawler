import { shouldPromoteToNemesis, promoteToNemesis } from './nemesis.js';
import { randomizeShop } from '../state/world-state.js';
import { DEATH_CONSEQUENCES, ENEMY_TEMPLATES } from '@dungeon/content';
function isTrapHazardCause(value) {
    return (typeof value === 'object'
        && value !== null
        && 'type' in value
        && value.type === 'TRAP_HAZARD');
}
/** Handle player death — end run, return to town with penalties */
export function handlePlayerDeath(state, causeOrKillerId, cause, rng, overkillDamage) {
    // Overload detection: if first arg is a TrapHazardCause object, handle trap death
    if (isTrapHazardCause(causeOrKillerId)) {
        return handleTrapHazardDeath(state, causeOrKillerId);
    }
    // Otherwise, use old signature (enemy death)
    const killerId = causeOrKillerId;
    if (typeof cause !== 'string' || typeof rng === 'undefined') {
        throw new Error('handlePlayerDeath: cause and rng are required for enemy deaths');
    }
    return handleEnemyDeath(state, killerId, cause, rng, overkillDamage);
}
function handleTrapHazardDeath(state, trapCause) {
    // Guard: player must be in a dungeon run to die
    if (state.run === null) {
        return { state, events: [] };
    }
    const run = state.run;
    const { hazardName, damage } = trapCause;
    const overkillDamage = Math.max(0, damage - state.player.stats.health);
    let events = [];
    // --- Permadeath check ---
    const threshold = DEATH_CONSEQUENCES.overkillPermadeathThreshold * state.player.stats.maxHealth;
    if (overkillDamage > threshold) {
        events = [
            {
                type: 'PERMADEATH',
                killerId: null,
                floor: state.player.floor,
                overkillDamage,
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            },
            {
                type: 'RUN_ENDED',
                runId: run.runId,
                reason: 'permadeath',
                floorsCleared: state.player.floor - 1,
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            },
            {
                type: 'PHASE_CHANGED',
                from: state.phase,
                to: 'game_over',
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            },
        ];
        // Save current floor to persistedFloorCache even on permadeath
        const currentFloorDepth = state.player.floor;
        const currentFloorSnapshot = {
            floor: run.floor,
            enemies: run.enemies,
            objects: run.objects,
            playerPosition: state.player.position,
        };
        const baseCache = state.persistedFloorCache ?? new Map();
        const updatedCache = baseCache instanceof Map
            ? new Map(baseCache)
            : new Map();
        updatedCache.set(currentFloorDepth, currentFloorSnapshot);
        const newState = {
            ...state,
            phase: 'game_over',
            run: null,
            persistedFloorCache: updatedCache,
            lastRetreatFloor: currentFloorDepth,
            lastRunMetrics: run.runMetrics,
        };
        return { state: newState, events };
    }
    // --- Normal death ---
    const goldLoss = Math.floor(state.player.gold * DEATH_CONSEQUENCES.goldLossPercent);
    events = [
        {
            type: 'PLAYER_DIED',
            killerId: null,
            killerName: hazardName,
            killerSpriteName: null,
            floor: state.player.floor,
            cause: `Killed by ${hazardName}`,
            goldLost: goldLoss,
            overkillDamage,
            timestamp: Date.now(),
            turnNumber: state.turnNumber,
        },
        {
            type: 'RUN_ENDED',
            runId: run.runId,
            reason: 'death',
            floorsCleared: state.player.floor - 1,
            timestamp: Date.now(),
            turnNumber: state.turnNumber,
        },
        {
            type: 'PHASE_CHANGED',
            from: state.phase,
            to: 'town',
            timestamp: Date.now(),
            turnNumber: state.turnNumber,
        },
    ];
    // --- Create death stash from equipped items ---
    const equipmentSlots = ['weapon', 'secondaryWeapon', 'chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'];
    const stashItems = equipmentSlots
        .map(slot => {
        const itemId = state.player.equipment[slot];
        if (itemId === null)
            return null;
        const template = state.itemRegistry.items.get(itemId);
        if (template === undefined)
            return null;
        return {
            slot: String(slot),
            item: template,
            entityId: itemId,
        };
    })
        .filter((item) => item !== null);
    let newDeathStash = null;
    const deathStashEvents = stashItems.length > 0
        ? [
            {
                type: 'EQUIPMENT_DROPPED',
                floor: state.player.floor,
                items: stashItems.map(s => ({ slot: s.slot, itemName: s.item.name })),
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            },
        ]
        : [];
    if (stashItems.length > 0) {
        newDeathStash = {
            floor: state.player.floor,
            position: state.player.position,
            items: stashItems,
        };
    }
    events = [...events, ...deathStashEvents];
    // Save current floor to persistedFloorCache
    const currentFloorDepth = state.player.floor;
    const currentFloorSnapshot = {
        floor: run.floor,
        enemies: run.enemies,
        objects: run.objects,
        playerPosition: state.player.position,
    };
    const baseCache = state.persistedFloorCache ?? new Map();
    const updatedCache = baseCache instanceof Map
        ? new Map(baseCache)
        : new Map();
    updatedCache.set(currentFloorDepth, currentFloorSnapshot);
    // --- Gold loss ---
    const newGold = Math.max(0, state.player.gold - goldLoss);
    // --- Clear equipment ---
    const clearedEquipment = {
        weapon: null,
        secondaryWeapon: null,
        chest: null,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
    };
    const newState = {
        ...state,
        phase: 'town',
        run: null,
        persistedFloorCache: updatedCache,
        lastRunMetrics: run.runMetrics,
        player: {
            ...state.player,
            gold: newGold,
            equipment: clearedEquipment,
            stats: { ...state.player.stats, health: state.player.stats.maxHealth },
            statuses: [],
            totalDeaths: state.player.totalDeaths + 1,
            totalRuns: state.player.totalRuns + 1,
            deathStash: newDeathStash,
        },
        world: {
            ...state.world,
        },
    };
    return { state: newState, events };
}
function handleEnemyDeath(state, killerId, cause, rng, overkillDamage) {
    // Guard: player must be in a dungeon run to die
    if (state.run === null) {
        return { state, events: [] };
    }
    const run = state.run;
    let events = [];
    // --- Permadeath check ---
    const threshold = DEATH_CONSEQUENCES.overkillPermadeathThreshold * state.player.stats.maxHealth;
    if (overkillDamage !== undefined && overkillDamage > threshold) {
        events = [
            {
                type: 'PERMADEATH',
                killerId,
                floor: state.player.floor,
                overkillDamage,
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            },
            {
                type: 'RUN_ENDED',
                runId: run.runId,
                reason: 'permadeath',
                floorsCleared: state.player.floor - 1,
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            },
            {
                type: 'PHASE_CHANGED',
                from: state.phase,
                to: 'game_over',
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            },
        ];
        // Save current floor to persistedFloorCache even on permadeath
        const currentFloorDepth = state.player.floor;
        const currentFloorSnapshot = {
            floor: run.floor,
            enemies: run.enemies,
            objects: run.objects,
            playerPosition: state.player.position,
        };
        // Safely copy the cache, handling both Map instances and undefined
        const baseCache = state.persistedFloorCache ?? new Map();
        const updatedCache = baseCache instanceof Map
            ? new Map(baseCache)
            : new Map();
        updatedCache.set(currentFloorDepth, currentFloorSnapshot);
        const newState = {
            ...state,
            phase: 'game_over',
            run: null,
            persistedFloorCache: updatedCache,
            lastRetreatFloor: currentFloorDepth,
            lastRunMetrics: run.runMetrics,
        };
        return { state: newState, events };
    }
    // --- Normal death ---
    // Compute killer info early so it can go into the event
    const killer = killerId !== null
        ? [...run.enemies.values()].find(e => e.id === killerId) ?? null
        : null;
    const killerTemplate = killer !== null
        ? ENEMY_TEMPLATES.get(killer.templateId) ?? null
        : null;
    const goldLoss = Math.floor(state.player.gold * DEATH_CONSEQUENCES.goldLossPercent);
    events = [
        {
            type: 'PLAYER_DIED',
            killerId,
            killerName: killer?.name ?? null,
            killerSpriteName: killerTemplate?.spriteName ?? null,
            floor: state.player.floor,
            cause,
            goldLost: goldLoss,
            overkillDamage: overkillDamage ?? 0,
            timestamp: Date.now(),
            turnNumber: state.turnNumber,
        },
        {
            type: 'RUN_ENDED',
            runId: run.runId,
            reason: 'death',
            floorsCleared: state.player.floor - 1,
            timestamp: Date.now(),
            turnNumber: state.turnNumber,
        },
        {
            type: 'PHASE_CHANGED',
            from: state.phase,
            to: 'town',
            timestamp: Date.now(),
            turnNumber: state.turnNumber,
        },
    ];
    // --- Create death stash from equipped items ---
    const equipmentSlots = ['weapon', 'secondaryWeapon', 'chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'];
    const stashItems = equipmentSlots
        .map(slot => {
        const itemId = state.player.equipment[slot];
        if (itemId === null)
            return null;
        const template = state.itemRegistry.items.get(itemId);
        if (template === undefined)
            return null;
        return {
            slot: String(slot),
            item: template,
            entityId: itemId,
        };
    })
        .filter((item) => item !== null);
    // Create death stash only if there are items
    let newDeathStash = null;
    const deathStashEvents = stashItems.length > 0
        ? [
            {
                type: 'EQUIPMENT_DROPPED',
                floor: state.player.floor,
                items: stashItems.map(s => ({ slot: s.slot, itemName: s.item.name })),
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            },
        ]
        : [];
    if (stashItems.length > 0) {
        newDeathStash = {
            floor: state.player.floor,
            position: state.player.position,
            items: stashItems,
        };
    }
    // --- Nemesis promotion ---
    let newWorld = state.world;
    let nemesisEvents = [];
    if (killer !== null && shouldPromoteToNemesis(state, killer, state.player.floor, rng)) {
        const promotionResult = promoteToNemesis(state, killer, state.player.floor, rng);
        newWorld = promotionResult.state.world;
        nemesisEvents = promotionResult.events.filter(e => e.type === 'NEMESIS_PROMOTED');
    }
    events = [...events, ...deathStashEvents, ...nemesisEvents];
    // Save current floor to persistedFloorCache
    const currentFloorDepth = state.player.floor;
    const currentFloorSnapshot = {
        floor: run.floor,
        enemies: run.enemies,
        objects: run.objects,
        playerPosition: state.player.position,
    };
    // Safely copy the cache, handling both Map instances and undefined
    const baseCache = state.persistedFloorCache ?? new Map();
    const updatedCache = baseCache instanceof Map
        ? new Map(baseCache)
        : new Map();
    updatedCache.set(currentFloorDepth, currentFloorSnapshot);
    // --- Gold loss: 25% of current gold (already computed for event above) ---
    const newGold = Math.max(0, state.player.gold - goldLoss);
    // --- Clear equipment ---
    const clearedEquipment = {
        weapon: null,
        secondaryWeapon: null,
        chest: null,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
    };
    // --- Randomize shop for next visit ---
    const newShop = randomizeShop(rng);
    const newState = {
        ...state,
        phase: 'town',
        run: null,
        persistedFloorCache: updatedCache,
        lastRunMetrics: run.runMetrics,
        player: {
            ...state.player,
            gold: newGold,
            equipment: clearedEquipment,
            stats: { ...state.player.stats, health: state.player.stats.maxHealth },
            statuses: [],
            totalDeaths: state.player.totalDeaths + 1,
            totalRuns: state.player.totalRuns + 1,
            deathStash: newDeathStash,
        },
        world: {
            ...newWorld,
            shop: newShop,
        },
    };
    return { state: newState, events };
}
//# sourceMappingURL=death.js.map