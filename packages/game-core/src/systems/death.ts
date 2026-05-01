import type { DomainEvent, GameState, EntityId, Equipment, DeathStash, DeathStashItem, StoredFloor } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
import { EMPTY_RUN_METRICS } from '@dungeon/contracts';
import { randomizeShop } from '../state/world-state.js';
import { applyFactionDeathConsequences } from './factions.js';
import { DEATH_CONSEQUENCES, ENEMY_TEMPLATES, getPrimaryFactionId } from '@dungeon/content';

interface TrapHazardCause {
  type: 'TRAP_HAZARD';
  hazardId: string;
  hazardName: string;
  damage: number;
}

function isTrapHazardCause(value: unknown): value is TrapHazardCause {
  return (
    typeof value === 'object'
    && value !== null
    && 'type' in value
    && (value as Record<string, unknown>).type === 'TRAP_HAZARD'
  );
}

/** Handle player death — end run, return to town with penalties */
export function handlePlayerDeath(
  state: GameState,
  causeOrKillerId: TrapHazardCause | EntityId | null,
  cause?: string,
  rng?: SeededRNG,
  overkillDamage?: number,
): { state: GameState; events: DomainEvent[] } {
  // Overload detection: if first arg is a TrapHazardCause object, handle trap death
  if (isTrapHazardCause(causeOrKillerId)) {
    return handleTrapHazardDeath(state, causeOrKillerId);
  }

  // Otherwise, use old signature (enemy death)
  const killerId = causeOrKillerId as EntityId | null;
  if (typeof cause !== 'string' || typeof rng === 'undefined') {
    throw new Error('handlePlayerDeath: cause and rng are required for enemy deaths');
  }
  return handleEnemyDeath(state, killerId, cause, rng, overkillDamage);
}

function handleTrapHazardDeath(
  state: GameState,
  trapCause: TrapHazardCause,
): { state: GameState; events: DomainEvent[] } {
  // Guard: player must be in a dungeon run to die
  if (state.run === null) {
    return { state, events: [] };
  }

  const run = state.run;
  const { hazardName, damage } = trapCause;
  const overkillDamage = Math.max(0, damage - state.player.stats.health);

  let events: DomainEvent[] = [];

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

    const baseCache = state.persistedFloorCache ?? new Map<number, StoredFloor>();
    const updatedCache = baseCache instanceof Map 
      ? new Map(baseCache)
      : new Map<number, StoredFloor>();
    updatedCache.set(currentFloorDepth, currentFloorSnapshot);

    const finalRunMetrics = {
      ...(run.runMetrics ?? EMPTY_RUN_METRICS),
      causeOfEnd: 'death' as const,
      floorsCleared: state.player.floor - 1,
    };

    const newState: GameState = {
      ...state,
      phase: 'game_over',
      run: null,
      persistedFloorCache: updatedCache,
      lastRetreatFloor: currentFloorDepth,
      lastRunMetrics: finalRunMetrics,
    };

    return { state: newState, events };
  }

  // --- Normal death ---
  const goldLoss = Math.floor(state.player.gold * DEATH_CONSEQUENCES.goldLossPercent);
  const finalRunMetrics = {
    ...(run.runMetrics ?? EMPTY_RUN_METRICS),
    causeOfEnd: 'death' as const,
    floorsCleared: state.player.floor - 1,
  };

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

  events = [...events, ...deathStashEvents];

  // Save current floor to persistedFloorCache
  const currentFloorDepth = state.player.floor;
  const currentFloorSnapshot = {
    floor: run.floor,
    enemies: run.enemies,
    objects: run.objects,
    playerPosition: state.player.position,
  };

  const baseCache = state.persistedFloorCache ?? new Map<number, StoredFloor>();
  const updatedCache = baseCache instanceof Map 
    ? new Map(baseCache)
    : new Map<number, StoredFloor>();
  updatedCache.set(currentFloorDepth, currentFloorSnapshot);

  // --- Gold loss ---
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

  const newState: GameState = {
    ...state,
    phase: 'town',
    run: null,
    persistedFloorCache: updatedCache,
    lastRunMetrics: finalRunMetrics,
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

function handleEnemyDeath(
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

    const finalRunMetrics = {
      ...(run.runMetrics ?? EMPTY_RUN_METRICS),
      causeOfEnd: 'death' as const,
      floorsCleared: state.player.floor - 1,
    };

    const newState: GameState = {
      ...state,
      phase: 'game_over',
      run: null,
      persistedFloorCache: updatedCache,
      lastRetreatFloor: currentFloorDepth,
      lastRunMetrics: finalRunMetrics,
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
  const finalRunMetrics = {
    ...(run.runMetrics ?? EMPTY_RUN_METRICS),
    causeOfEnd: 'death' as const,
    floorsCleared: state.player.floor - 1,
  };

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

  events = [...events, ...deathStashEvents];

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

  // --- Gold loss: 25% of current gold (already computed for event above) ---
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
  const factionResult = applyFactionDeathConsequences(
    state.world,
    getPrimaryFactionId(killer?.templateId ?? ''),
    { timestamp: Date.now(), turnNumber: state.turnNumber, depth: state.player.floor },
  );
  events = [...events, ...factionResult.events];

  const newState: GameState = {
    ...state,
    phase: 'town',
    run: null,
    persistedFloorCache: updatedCache,
    lastRunMetrics: finalRunMetrics,
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
      ...factionResult.world,
      shop: newShop,
    },
  };

  return { state: newState, events };
}
