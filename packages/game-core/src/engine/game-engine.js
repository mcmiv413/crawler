import { entityId, posKey } from '@dungeon/contracts';
import { chebyshevDistance } from '../utils/grid.js';
import { generateId } from '../utils/id.js';
import { BASE_PLAYER_STATS, ECONOMY, BIOME_BY_FLOOR } from '@dungeon/content';
import { EMPTY_RUN_METRICS, EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import { SeededRNG } from '../utils/rng.js';
import { handleCommand } from './command-handler.js';
import { generateFloor } from '../generation/map-generator.js';
import { populateFloor } from '../generation/floor-populator.js';
import { validateSpawns } from '../generation/spawn-validator.js';
import { computeFov } from '../systems/fov.js';
import { createInitialWorldState } from '../state/world-state.js';
import { buildWorldModifiers } from '../systems/world-modifiers.js';
import { executeRetreat } from '../systems/retreat.js';
import { applyRunConsequences } from '../systems/world-consequences.js';
import { simulatePersistedFloorTimeElapsed } from '../systems/enemy-respawn.js';
import { completeFloorDepthQuests } from '../systems/quests.js';
import { evaluateAllQuestProgress } from './quest-evaluator.js';
export class GameEngine {
    createNewGame(seed) {
        // eslint-disable-next-line no-restricted-syntax -- seed entry point, generate with high-quality entropy
        const gameSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
        const gameId = entityId(generateId());
        const playerId = entityId(generateId());
        const rng = new SeededRNG(gameSeed);
        const state = {
            gameId,
            phase: 'town',
            player: {
                id: playerId,
                name: 'Adventurer',
                level: 1,
                experience: 0,
                stats: { ...BASE_PLAYER_STATS },
                baseStats: { ...BASE_PLAYER_STATS },
                position: { x: 0, y: 0 },
                equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
                inventory: [],
                statuses: [],
                abilities: [],
                gold: ECONOMY.startingGold,
                floor: 0,
                totalKills: 0,
                totalDeaths: 0,
                totalRuns: 0,
                deathStash: null,
            },
            run: null,
            world: createInitialWorldState(rng),
            itemRegistry: { items: new Map() },
            seed: gameSeed,
            turnNumber: 0,
            version: 1,
            activeQuests: [],
            weaponMastery: EMPTY_WEAPON_MASTERY,
        };
        return state;
    }
    submitCommand(state, command) {
        const rng = new SeededRNG(state.seed + state.turnNumber);
        // Special handling: enter dungeon generates a new floor
        if (command.type === 'TOWN_ACTION' && command.action === 'enter_dungeon') {
            return this.enterDungeon(state, rng, command.startDepth);
        }
        // Special handling: ascend command
        if (command.type === 'ASCEND' && state.run) {
            return this.ascendFloor(state, [], rng);
        }
        // Special handling: descend/ascend stairs on move
        if (command.type === 'MOVE' && state.run) {
            const result = handleCommand(state, command, rng);
            if (result.state.run && !result.runEnded) {
                const playerKey = posKey(result.state.player.position);
                const cell = result.state.run.floor.cells.get(playerKey);
                if (cell?.tile.type === 'stairs_down') {
                    return this.descendFloor(result.state, rng, result.events);
                }
                if (cell?.tile.type === 'stairs_up' && result.state.run.floorHistory.length > 0) {
                    // Auto-ascend only when there's a prior floor to return to.
                    // On floor 1 (no history), stairs_up is the entrance — use RETREAT to leave.
                    return this.ascendFloor(result.state, result.events, rng);
                }
            }
            return this.applyConsequencesIfRunEnded(result);
        }
        const result = handleCommand(state, command, rng);
        const afterConsequences = this.applyConsequencesIfRunEnded(result);
        // Evaluate quest progress after command execution
        const questEval = evaluateAllQuestProgress(afterConsequences.state);
        return {
            state: questEval.state,
            events: [...afterConsequences.events, ...questEval.events],
            runEnded: afterConsequences.runEnded,
        };
    }
    /**
     * If a run has ended, apply world consequences (town state deltas, faction ticks, event chains).
     * This ensures consequences are always applied by the engine, regardless of server-side handling.
     */
    applyConsequencesIfRunEnded(result) {
        if (result.runEnded !== true || result.state.run === null) {
            return result;
        }
        const runMetrics = result.state.run.runMetrics;
        if (runMetrics === undefined) {
            return result;
        }
        const consequenceResult = applyRunConsequences(result.state, runMetrics);
        return {
            state: consequenceResult.state,
            events: [...result.events, ...consequenceResult.events],
            runEnded: result.runEnded,
        };
    }
    enterDungeon(state, rng, startDepth) {
        // Area 4b: Clamp startDepth to [1, deepestFloor - 1]
        const maxAllowed = Math.max(1, state.world.deepestFloor);
        // If no depth specified, continue from last retreat floor if available
        const defaultDepth = state.lastRetreatFloor !== undefined ? Math.max(1, Math.min(state.lastRetreatFloor, maxAllowed)) : 1;
        const depth = startDepth !== undefined ? Math.max(1, Math.min(startDepth, maxAllowed)) : defaultDepth;
        // Phase A2: Check if this floor is already cached from a previous run
        const cachedFloor = state.persistedFloorCache?.get(depth);
        let events = [];
        let floor;
        let enemies;
        let objects;
        if (cachedFloor !== undefined) {
            // Restore cached floor and simulate time elapsed for respawning
            const biome = BIOME_BY_FLOOR(depth, rng);
            const turnsSinceVisit = state.turnNumber - (cachedFloor.lastSimulatedTurn ?? 0);
            // Simulate respawning and ambient behavior based on time elapsed
            const simulatedFloor = simulatePersistedFloorTimeElapsed(cachedFloor, turnsSinceVisit, biome, depth, rng);
            floor = simulatedFloor.floor;
            enemies = simulatedFloor.enemies;
            objects = simulatedFloor.objects;
            // Update FOV from entrance (cached floor doesn't have updated visibility)
            const visibleCells = computeFov(floor, floor.entrance);
            floor = { ...floor, cells: visibleCells };
        }
        else {
            // Generate fresh floor
            const biome = BIOME_BY_FLOOR(depth, rng);
            const { floor: generatedFloor } = generateFloor(depth, biome, rng);
            const worldMods = buildWorldModifiers(state.world, depth);
            const { enemies: genEnemies, objects: genObjects } = populateFloor(generatedFloor, biome, rng, worldMods);
            // Validate spawns and fix if needed
            const validation = validateSpawns(generatedFloor, genEnemies);
            const finalEnemies = validation.valid === true ? genEnemies : fixSpawns(generatedFloor, genEnemies);
            // Update FOV from entrance
            const visibleCells = computeFov(generatedFloor, generatedFloor.entrance);
            floor = { ...generatedFloor, cells: visibleCells };
            enemies = finalEnemies;
            objects = genObjects;
        }
        const runId = entityId(generateId());
        events = [...events, {
                type: 'RUN_STARTED',
                runId,
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            }];
        events = [...events, {
                type: 'PHASE_CHANGED',
                from: 'town',
                to: 'dungeon',
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            }];
        events = [...events, {
                type: 'FLOOR_ENTERED',
                depth,
                biomeId: floor.biomeId,
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            }];
        // Initialize speed accumulators for each enemy (for kiting system)
        const speedAccumulators = {};
        for (const enemy of enemies.values()) {
            speedAccumulators[enemy.id] = 0;
        }
        let newState = {
            ...state,
            phase: 'dungeon',
            player: {
                ...state.player,
                position: floor.entrance,
                floor: depth,
            },
            run: {
                runId,
                floor,
                enemies,
                objects,
                turnCount: 0,
                isActive: true,
                runMetrics: EMPTY_RUN_METRICS,
                floorHistory: [],
                floorCache: new Map(),
                speedAccumulators,
            },
            lastRunMetrics: undefined, // Clear previous run metrics when starting new run
            turnNumber: state.turnNumber + 1,
        };
        // Check for death stash recovery
        const recovery = this.tryRecoverDeathStash(newState, depth);
        if (recovery !== null) {
            newState = recovery.state;
            events = [...events, ...recovery.events];
        }
        // D1: Check for floor depth quest completion
        const questResult = completeFloorDepthQuests(newState, depth);
        newState = questResult.state;
        events = [...events, ...questResult.events];
        return { state: newState, events, runEnded: false };
    }
    descendFloor(state, rng, previousEvents) {
        const newDepth = (state.run?.floor.depth ?? 0) + 1;
        const biome = BIOME_BY_FLOOR(newDepth, rng);
        let events = [...previousEvents];
        // Save current floor to history (capped at 3)
        const snapshot = {
            floor: state.run.floor,
            enemies: state.run.enemies,
            objects: state.run.objects,
            playerPosition: state.player.position,
        };
        const newHistory = [...state.run.floorHistory, snapshot].slice(-3);
        const existingCache = state.run.floorCache ?? new Map();
        // Check persisted cache first (floors from previous runs), then in-run cache
        let cached = state.persistedFloorCache?.get(newDepth);
        if (cached === undefined) {
            cached = existingCache.get(newDepth);
        }
        let fovFloor;
        let finalEnemies;
        let objects;
        let playerPosition;
        if (cached !== undefined) {
            const restoredCells = computeFov(cached.floor, cached.floor.entrance);
            fovFloor = { ...cached.floor, cells: restoredCells };
            finalEnemies = cached.enemies;
            objects = cached.objects;
            playerPosition = cached.floor.entrance;
        }
        else {
            const { floor } = generateFloor(newDepth, biome, rng);
            const worldMods = buildWorldModifiers(state.world, newDepth);
            const { enemies: generatedEnemies, objects: generatedObjects } = populateFloor(floor, biome, rng, worldMods);
            const validation = validateSpawns(floor, generatedEnemies);
            finalEnemies = validation.valid === true ? generatedEnemies : fixSpawns(floor, generatedEnemies);
            const visibleCells = computeFov(floor, floor.entrance);
            fovFloor = { ...floor, cells: visibleCells };
            objects = generatedObjects;
            playerPosition = floor.entrance;
        }
        events = [...events, {
                type: 'FLOOR_ENTERED',
                depth: newDepth,
                biomeId: biome.biomeId,
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            }];
        // Initialize speed accumulators for each new enemy (for kiting system)
        const speedAccumulators = {};
        for (const enemy of finalEnemies.values()) {
            speedAccumulators[enemy.id] = 0;
        }
        let newState = {
            ...state,
            player: {
                ...state.player,
                position: playerPosition,
                floor: newDepth,
            },
            run: {
                ...state.run,
                floor: fovFloor,
                enemies: finalEnemies,
                objects,
                turnCount: 0,
                floorHistory: newHistory,
                floorCache: existingCache,
                speedAccumulators,
            },
            world: {
                ...state.world,
                deepestFloor: Math.max(state.world.deepestFloor, newDepth),
            },
        };
        // Check for death stash recovery
        const recovery = this.tryRecoverDeathStash(newState, newDepth);
        if (recovery !== null) {
            newState = recovery.state;
            events = [...events, ...recovery.events];
        }
        // D1: Check for floor depth quest completion
        const questResult = completeFloorDepthQuests(newState, newDepth);
        newState = questResult.state;
        events = [...events, ...questResult.events];
        return { state: newState, events, runEnded: false };
    }
    ascendFloor(state, previousEvents, rng) {
        if (state.run === null)
            return { state, events: [...previousEvents], runEnded: false };
        let events = [...previousEvents];
        // If on floor 1 or below, treat as retreat to town
        if (state.player.floor <= 1) {
            const retreatResult = executeRetreat(state, rng);
            return { state: retreatResult.state, events: [...events, ...retreatResult.events], runEnded: true };
        }
        const currentDepth = state.run.floor.depth;
        const targetDepth = currentDepth - 1;
        const biome = BIOME_BY_FLOOR(targetDepth, rng);
        // Save current floor to cache so re-descending restores the cleared state
        const cacheSnapshot = {
            floor: state.run.floor,
            enemies: state.run.enemies,
            objects: state.run.objects,
            playerPosition: state.player.position,
        };
        const newCache = new Map(state.run.floorCache ?? []);
        newCache.set(currentDepth, cacheSnapshot);
        // Try to load from floorHistory first (for initial descents), then run cache, then persisted cache
        const fromHistory = state.run.floorHistory.length > 0 ? state.run.floorHistory[0] : undefined;
        const cached = fromHistory ?? state.run.floorCache?.get(targetDepth) ?? state.persistedFloorCache?.get(targetDepth);
        let restoredFloor;
        let restoredEnemies;
        let restoredObjects;
        let playerPosition;
        if (cached !== undefined) {
            // Restore from cache or history
            const restoredCells = computeFov(cached.floor, cached.playerPosition);
            restoredFloor = { ...cached.floor, cells: restoredCells };
            restoredEnemies = cached.enemies;
            restoredObjects = cached.objects;
            playerPosition = cached.playerPosition;
        }
        else {
            // Generate fresh floor (shouldn't normally happen, but handle as fallback)
            const { floor } = generateFloor(targetDepth, biome, rng);
            const worldMods = buildWorldModifiers(state.world, targetDepth);
            const { enemies: genEnemies, objects: genObjects } = populateFloor(floor, biome, rng, worldMods);
            const validation = validateSpawns(floor, genEnemies);
            const finalEnemies = validation.valid === true ? genEnemies : fixSpawns(floor, genEnemies);
            const visibleCells = computeFov(floor, floor.entrance);
            restoredFloor = { ...floor, cells: visibleCells };
            restoredEnemies = finalEnemies;
            restoredObjects = genObjects;
            playerPosition = floor.entrance;
        }
        events = [...events, {
                type: 'FLOOR_ENTERED',
                depth: targetDepth,
                biomeId: biome.biomeId,
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            }];
        // Initialize speed accumulators for each enemy
        const speedAccumulators = {};
        for (const enemy of restoredEnemies.values()) {
            speedAccumulators[enemy.id] = 0;
        }
        const newState = {
            ...state,
            player: {
                ...state.player,
                position: playerPosition,
                floor: targetDepth,
            },
            run: {
                ...state.run,
                floor: restoredFloor,
                enemies: restoredEnemies,
                objects: restoredObjects,
                turnCount: 0,
                floorHistory: state.run.floorHistory.slice(0, -1),
                floorCache: newCache,
                speedAccumulators,
            },
        };
        // D1: Check for floor depth quest completion
        const questResult = completeFloorDepthQuests(newState, targetDepth);
        const finalState = questResult.state;
        events = [...events, ...questResult.events];
        return { state: finalState, events, runEnded: false };
    }
    tryRecoverDeathStash(state, floorDepth) {
        const stash = state.player.deathStash;
        if (!stash || stash.floor !== floorDepth)
            return null;
        let events = [];
        const newRegistry = new Map(state.itemRegistry.items);
        let newInventory = [...state.player.inventory];
        for (const stashItem of stash.items) {
            newRegistry.set(stashItem.entityId, stashItem.item);
            newInventory = [...newInventory, stashItem.entityId];
        }
        events = [...events, {
                type: 'EQUIPMENT_RECOVERED',
                items: stash.items.map(si => ({ slot: si.slot, itemName: si.item.name })),
                floor: floorDepth,
                timestamp: Date.now(),
                turnNumber: state.turnNumber,
            }];
        const newState = {
            ...state,
            player: {
                ...state.player,
                inventory: newInventory,
                deathStash: null,
            },
            itemRegistry: { items: newRegistry },
        };
        return { state: newState, events };
    }
}
/** Remove enemies that violate spawn rules */
function fixSpawns(floor, enemies) {
    const fixed = new Map(enemies);
    const entranceKey = posKey(floor.entrance);
    const exitKey = posKey(floor.exit);
    fixed.delete(entranceKey);
    fixed.delete(exitKey);
    for (const [key, enemy] of fixed) {
        const dist = chebyshevDistance(floor.entrance, enemy.position);
        if (dist <= 2) {
            fixed.delete(key);
        }
    }
    return fixed;
}
//# sourceMappingURL=game-engine.js.map