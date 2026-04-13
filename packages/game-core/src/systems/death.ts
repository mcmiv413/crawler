import type { GameState, EntityId, DeathStash, Equipment, DeathStashItem, StoredFloor } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
import { shouldPromoteToNemesis, promoteToNemesis } from './nemesis.js';
import { randomizeShop } from '../state/world-state.js';
import { DEATH_CONSEQUENCES } from '@dungeon/content';

/** Handle player death — end run, return to town with penalties */
export function handlePlayerDeath(
  state: GameState,
  killerId: EntityId | null,
  cause: string,
  rng: SeededRNG,
  overkillDamage?: number,
): { state: GameState; events: DomainEvent[] } {
  // Guard: player must be in a dungeon run to die
  if (state.run === null) {
    return { state, events: [] };
  }

  const run = state.run;
  let events: DomainEvent[] = [];

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
    const baseCache = state.persistedFloorCache ?? new Map<number, StoredFloor>();
    const updatedCache = baseCache instanceof Map 
      ? new Map(baseCache)
      : new Map<number, StoredFloor>();
    updatedCache.set(currentFloorDepth, currentFloorSnapshot);

    const newState: GameState = {
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
  events = [
    {
      type: 'PLAYER_DIED',
      killerId,
      floor: state.player.floor,
      cause,
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
  const equipmentSlots: (keyof Equipment)[] = ['weapon', 'secondaryWeapon', 'chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'];
  const stashItems: DeathStashItem[] = equipmentSlots
    .map(slot => {
      const itemId = state.player.equipment[slot];
      if (itemId === null) return null;

      const template = state.itemRegistry.items.get(itemId);
      if (template === undefined) return null;

      return {
        slot: String(slot),
        item: template,
        entityId: itemId,
      };
    })
    .filter((item): item is DeathStashItem => item !== null);

  // Create death stash only if there are items
  let newDeathStash: DeathStash | null = null;
  const deathStashEvents: DomainEvent[] = stashItems.length > 0
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
  let nemesisEvents: DomainEvent[] = [];
  if (killerId !== null) {
    // Find killer by entity ID (enemies map is keyed by position, so we need to search)
    const killer = [...run.enemies.values()].find(e => e.id === killerId);
    if (killer !== undefined && shouldPromoteToNemesis(state, killer, state.player.floor, rng)) {
      const promotionResult = promoteToNemesis(state, killer, state.player.floor, rng);
      newWorld = promotionResult.state.world;
      nemesisEvents = promotionResult.events.filter(e => e.type === 'NEMESIS_PROMOTED');
    }
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
  const baseCache = state.persistedFloorCache ?? new Map<number, StoredFloor>();
  const updatedCache = baseCache instanceof Map 
    ? new Map(baseCache)
    : new Map<number, StoredFloor>();
  updatedCache.set(currentFloorDepth, currentFloorSnapshot);

  // --- Gold loss: 25% of current gold ---
  const goldLoss = Math.floor(state.player.gold * DEATH_CONSEQUENCES.goldLossPercent);
  const newGold = Math.max(0, state.player.gold - goldLoss);

  // --- Clear equipment ---
  const clearedEquipment: Equipment = {
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

  const newState: GameState = {
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
