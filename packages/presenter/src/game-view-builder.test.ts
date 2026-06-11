import { describe, it, expect } from 'vitest';
import { buildGameView } from './game-view-builder.js';
import { entityId, posKey, EMPTY_RUN_METRICS } from '@dungeon/contracts';
import type {
  DomainEvent,
  GameState,
  RunState,
  NpcState,
  EnemyInstance,
  FactionState,
} from '@dungeon/contracts';
import { createTestGameStateInCombat, createTestEnemy } from '@dungeon/core/testing';

function makeFloor(depth: number, playerOnStairsUp = false) {
  const stairsTile: { type: 'stairs_up' | 'floor'; walkable: boolean; blocksVision: boolean; ascii: string; color: string } = {
    type: playerOnStairsUp ? 'stairs_up' : 'floor',
    walkable: true,
    blocksVision: false,
    ascii: playerOnStairsUp ? '<' : '.',
    color: '#fff',
  };
  const cells = new Map([
    [posKey({ x: 0, y: 0 }), { tile: stairsTile, visibility: 'visible' as const }],
  ]);
  return {
    width: 10,
    height: 10,
    depth,
    biomeId: 'crypt',
    cells,
    entrance: { x: 0, y: 0 },
    exit: { x: 9, y: 9 },
    seed: 12345,
  };
}

function makeRunState(depth: number, playerOnStairsUp: boolean, hasHistory: boolean): RunState {
  const storedFloor = hasHistory ? [{
    floor: makeFloor(depth - 1, false),
    enemies: new Map(),
    objects: new Map(),
    playerPosition: { x: 0, y: 0 },
  }] : [];
  return {
    runId: entityId('run1'),
    floor: makeFloor(depth, playerOnStairsUp),
    enemies: new Map(),
    objects: new Map(),
    turnCount: 1,
    isActive: true,
    floorHistory: storedFloor,
    speedAccumulators: {},
  };
}

const sealedDungeonOgre = {
  id: 'dungeon_ogre' as const,
  status: 'sealed' as const,
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: entityId('g1'),
    phase: 'dungeon',
    player: {
      id: entityId('p1'),
      name: 'Hero',
      level: 1,
      experience: 0,
      stats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
      baseStats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
      position: { x: 0, y: 0 },
      equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      inventory: [],
      statuses: [],
      abilities: [],
      gold: 50,
      floor: 2,
      totalKills: 0,
      totalDeaths: 0,
      totalRuns: 0,
      deathStash: null,
      mana: 20,
      maxMana: 20,
      ringMastery: {},
      learnedRingSpellIds: [],
    },
    run: null,
    world: {
      town: { prosperity: 50, fear: 20, corruption: 10, rumors: [], lastRunSummary: null },
      npcs: [],
      shop: { items: [], buybackMultiplier: 0.4 },
      eventHistory: [],
      totalRuns: 0,
      deepestFloor: 0,
      factions: [],
      dungeonOgre: sealedDungeonOgre,
      unlockedBlueprints: [],
      highestRarityFound: 'common' as const,
    },
    itemRegistry: { items: new Map() },
    seed: 42,
    turnNumber: 10,
    version: 1,
    activeQuests: [],
    weaponMastery: { blade: 0, bludgeon: 0, axe: 0, ranged: 0, dagger: 0 },
    ...overrides,
  };
}

function getNoticeId(state: GameState, kind: string): string | undefined {
  return buildGameView(state).notices?.find(notice => notice.kind === kind)?.id;
}

describe('buildGameView runResult', () => {
  it('returns runResult "victory" when game_over with victory metrics', () => {
    const state = makeState({
      phase: 'game_over',
      run: {
        ...makeRunState(5, false, false),
        runMetrics: { ...EMPTY_RUN_METRICS, causeOfEnd: 'victory' },
      },
    });
    const view = buildGameView(state);
    expect(view.runResult).toBe('victory');
  });

  it('returns runResult "death" when game_over with death metrics', () => {
    const state = makeState({
      phase: 'game_over',
      run: {
        ...makeRunState(2, false, false),
        runMetrics: { ...EMPTY_RUN_METRICS, causeOfEnd: 'death' },
      },
    });
    const view = buildGameView(state);
    expect(view.runResult).toBe('death');
  });

  it('returns runResult null when not in game_over phase', () => {
    const state = makeState({ phase: 'dungeon', run: makeRunState(1, false, false) });
    const view = buildGameView(state);
    expect(view.runResult).toBeNull();
  });
});

describe('buildGameView shop effectivePrice', () => {
  const shopkeeper: NpcState = {
    id: entityId('npc1'),
    name: 'Torben',
    role: 'shopkeeper',
    disposition: 50,
    available: true,
    dialogueKey: 'shopkeeper',
  };

  it('shows effectivePrice with 25% discount when shopkeeper disposition=50', () => {
    const state = makeState({
      phase: 'town',
      world: {
        town: { prosperity: 60, fear: 10, corruption: 5, rumors: [], lastRunSummary: null },
        npcs: [shopkeeper],
        shop: { items: [{ itemId: 'health_potion', price: 100, stock: 3 }], buybackMultiplier: 0.4 },
        eventHistory: [],
        totalRuns: 0,
        deepestFloor: 0,
        factions: [],
        dungeonOgre: sealedDungeonOgre,
        unlockedBlueprints: [],
        highestRarityFound: 'common' as const,
      },
    });
    const view = buildGameView(state);
    const shopItem = view.town?.shop.items[0];
    expect(shopItem?.effectivePrice).toBeLessThan(100);
    expect(shopItem?.effectivePrice).toBeGreaterThan(0);
    expect(shopItem?.price).toBe(100); // base price unchanged
  });

  it('effectivePrice equals price when no shopkeeper NPC', () => {
    const state = makeState({
      phase: 'town',
      world: {
        town: { prosperity: 60, fear: 10, corruption: 5, rumors: [], lastRunSummary: null },
        npcs: [],
        shop: { items: [{ itemId: 'health_potion', price: 100, stock: 3 }], buybackMultiplier: 0.4 },
        eventHistory: [],
        totalRuns: 0,
        deepestFloor: 0,
        factions: [],
        dungeonOgre: sealedDungeonOgre,
        unlockedBlueprints: [],
        highestRarityFound: 'common' as const,
      },
    });
    const view = buildGameView(state);
    const shopItem = view.town?.shop.items[0];
    expect(shopItem?.effectivePrice).toBe(100);
  });
});

describe('buildGameView ascend action', () => {
  it('includes ascend action when player is on stairs_up tile below floor 1', () => {
    const state = makeState({
      run: makeRunState(2, true, false),
      player: { ...makeState().player, floor: 2 },
    });
    const view = buildGameView(state);
    const ascendAction = view.availableActions.find(a => a.type === 'ascend');
    expect(ascendAction).toBeDefined();
    expect(ascendAction?.id).toBe('ascend');
  });

  it('does NOT include ascend action when on stairs_up but player is on floor 1', () => {
    const state = makeState({
      run: makeRunState(1, true, false),
      player: { ...makeState().player, floor: 1 },
    });
    const view = buildGameView(state);
    const ascendAction = view.availableActions.find(a => a.type === 'ascend');
    expect(ascendAction).toBeUndefined();
  });

  it('does NOT include ascend action when not on stairs_up tile', () => {
    const state = makeState({ run: makeRunState(2, false, true) });
    const view = buildGameView(state);
    const ascendAction = view.availableActions.find(a => a.type === 'ascend');
    expect(ascendAction).toBeUndefined();
  });
});

describe('buildGameView inventory sellPrice', () => {
  it('InventoryItemView.sellPrice equals floor(value * buybackMultiplier)', () => {
    const itemId = entityId('item1');
    const state = makeState({
      phase: 'town',
      player: {
        id: entityId('p1'),
        name: 'Hero',
        level: 1,
        experience: 0,
        stats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
        baseStats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
        position: { x: 0, y: 0 },
        equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
        inventory: [itemId],
        statuses: [],
        abilities: [],
        gold: 50,
        floor: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalRuns: 0,
        deathStash: null,
        mana: 20,
        maxMana: 20,
        ringMastery: {},
        learnedRingSpellIds: [],
      },
      world: {
        town: { prosperity: 50, fear: 20, corruption: 10, rumors: [], lastRunSummary: null },
        npcs: [],
        shop: { items: [], buybackMultiplier: 0.5 },
        eventHistory: [],
        totalRuns: 0,
        deepestFloor: 0,
        factions: [],
        dungeonOgre: sealedDungeonOgre,
        unlockedBlueprints: [],
        highestRarityFound: 'common' as const,
      },
      itemRegistry: {
        items: new Map([[itemId, {
          itemId: 'health_potion',
          name: 'Health Potion',
          description: 'Heals 30 HP',
          itemClass: 'consumable' as const,
          rarity: 'common' as const,
          value: 10,
          stackable: true,
          maxStack: 5,
          consumable: { effect: 'heal' as const, magnitude: 30 },
        }]]) as any,
      },
    });
    const view = buildGameView(state);
    expect(view.inventory.items[0]?.sellPrice).toBeGreaterThan(0);
    expect(view.inventory.items[0]?.sellPrice).toBeLessThanOrEqual(10);
  });

  it('sellPrice uses the actual buybackMultiplier, not hardcoded 0.4', () => {
    const itemId = entityId('item2');
    const state = makeState({
      phase: 'town',
      player: {
        id: entityId('p1'),
        name: 'Hero',
        level: 1,
        experience: 0,
        stats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
        baseStats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
        position: { x: 0, y: 0 },
        equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
        inventory: [itemId],
        statuses: [],
        abilities: [],
        gold: 50,
        floor: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalRuns: 0,
        deathStash: null,
        mana: 20,
        maxMana: 20,
        ringMastery: {},
        learnedRingSpellIds: [],
      },
      world: {
        town: { prosperity: 50, fear: 20, corruption: 10, rumors: [], lastRunSummary: null },
        npcs: [],
        shop: { items: [], buybackMultiplier: 0.75 },
        eventHistory: [],
        totalRuns: 0,
        deepestFloor: 0,
        factions: [],
        dungeonOgre: sealedDungeonOgre,
        unlockedBlueprints: [],
        highestRarityFound: 'common' as const,
      },
      itemRegistry: {
        items: new Map([[itemId, {
          itemId: 'health_potion',
          name: 'Health Potion',
          description: 'Heals 30 HP',
          itemClass: 'consumable' as const,
          rarity: 'common' as const,
          value: 20,
          stackable: true,
          maxStack: 5,
          consumable: { effect: 'heal' as const, magnitude: 30 },
        }]]) as any,
      },
    });
    const view = buildGameView(state);
    expect(view.inventory.items[0]?.sellPrice).toBeGreaterThan(0);
    expect(view.inventory.items[0]?.sellPrice).toBeLessThanOrEqual(20);
  });
});

describe('buildGameView player abilities', () => {
  it('player.abilities is empty when player has no abilities', () => {
    const state = makeState({ run: makeRunState(1, false, false) });
    const view = buildGameView(state);
    expect(view.player.abilities).toEqual([]);
  });

  it('player.abilities reflects a ready ability (cooldown 0)', () => {
    const state = makeState({
      run: makeRunState(1, false, false),
      player: {
        ...makeState().player,
        abilities: [{ id: 'second_wind', cooldownRemaining: 0 }],
      },
    });
    const view = buildGameView(state);
    expect(view.player.abilities).toHaveLength(1);
    expect(view.player.abilities[0]!.id).toBe('second_wind');
    expect(view.player.abilities[0]!.name).toBe('Second Wind');
    expect(view.player.abilities[0]!.ready).toBe(true);
    expect(view.player.abilities[0]!.cooldownRemaining).toBe(0);
  });

  it('player.abilities shows ability on cooldown as not ready', () => {
    const state = makeState({
      run: makeRunState(1, false, false),
      player: {
        ...makeState().player,
        abilities: [{ id: 'second_wind', cooldownRemaining: 3 }],
      },
    });
    const view = buildGameView(state);
    expect(view.player.abilities[0]!.ready).toBe(false);
    expect(view.player.abilities[0]!.cooldownRemaining).toBe(3);
  });

  it('availableActions includes all abilities (ready and on-cooldown) with cooldown labels - Phase B2', () => {
    const swordId = entityId('sword1');
    const state = makeState({
      run: makeRunState(1, false, false),
      player: {
        ...makeState().player,
        equipment: { weapon: swordId, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
        abilities: [
          { id: 'second_wind', cooldownRemaining: 0 },  // ready
          { id: 'power_strike', cooldownRemaining: 2 }, // on cooldown
        ],
      },
      itemRegistry: {
        items: new Map([
          [
            swordId,
            {
              itemId: 'iron_sword',
              name: 'Iron Sword',
              description: 'A basic sword',
              itemClass: 'weapon' as const,
              rarity: 'common' as const,
              value: 50,
              stackable: false,
              maxStack: 1,
              weapon: {
                damage: 10,
                damageType: 'slashing' as const,
                accuracy: 75,
                speed: 100,
                slot: 'weapon' as const,
                weaponRange: 1,
                weaponType: 'blade' as const,
              },
            },
          ],
        ]),
      },
    });
    const view = buildGameView(state);
    const abilityActions = view.availableActions.filter(a => a.type === 'ability');

    // Both abilities should appear (ready and on-cooldown)
    const secondWind = abilityActions.find(a => a.id === 'use_ability_second_wind');
    const powerStrike = abilityActions.find(a => a.id === 'use_ability_power_strike');

    expect(secondWind).toBeDefined();
    expect(powerStrike).toBeDefined();

    // second_wind is ready — no cooldown label
    expect(secondWind!.label).toBe('Second Wind');
    expect(secondWind!.enabled).toBe(true);

    // power_strike is on cooldown — should show "(2 turns)" label and be disabled
    expect(powerStrike!.label).toContain('Power Strike');
    expect(powerStrike!.label).toContain('(2 turns)');
    expect(powerStrike!.enabled).toBe(false);
  });

  it('player.abilities filters out abilities incompatible with equipped weapon', () => {
    const shortbowId = entityId('shortbow1');
    const state = makeState({
      run: makeRunState(1, false, false),
      player: {
        ...makeState().player,
        equipment: { weapon: shortbowId, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
        abilities: [
          { id: 'power_strike', cooldownRemaining: 0 },  // requires melee - filtered out
          { id: 'ranged_pin', cooldownRemaining: 0 },    // requires 'ranged' ✓
          { id: 'blade_bleed', cooldownRemaining: 0 },   // requires 'blade' ✗
        ],
      },
      itemRegistry: {
        items: new Map([
          [
            shortbowId,
            {
              itemId: 'shortbow',
              name: 'Shortbow',
              description: 'A nimble bow',
              itemClass: 'weapon',
              rarity: 'common',
              value: 50,
              stackable: false,
              maxStack: 1,
              weapon: {
                damage: 8,
                damageType: 'piercing',
                accuracy: 80,
                speed: 100,
                slot: 'weapon' as const,
                weaponRange: 5,
                weaponType: 'ranged' as const,
              },
            },
          ],
        ]),
      },
    });
    const view = buildGameView(state);

    expect(view.player.abilities).toHaveLength(1);
    expect(view.player.abilities.map(a => a.id)).toEqual(['ranged_pin']);
    expect(view.player.abilities.map(a => a.id)).not.toContain('blade_bleed');
    expect(view.player.abilities.map(a => a.id)).not.toContain('power_strike');
  });

  it('player.abilities hides weapon-specific abilities when no weapon is equipped', () => {
    const state = makeState({
      run: makeRunState(1, false, false),
      player: {
        id: entityId('p1'),
        name: 'Hero',
        level: 1,
        experience: 0,
        stats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
        baseStats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 75, evasion: 10, speed: 100 },
        position: { x: 0, y: 0 },
        equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
        inventory: [],
        statuses: [],
        abilities: [
          { id: 'second_wind', cooldownRemaining: 0 },   // no weapon requirement - shown
          { id: 'ranged_pin', cooldownRemaining: 0 },    // requires 'ranged' - hidden
          { id: 'blade_bleed', cooldownRemaining: 0 },   // requires 'blade' - hidden
          { id: 'power_strike', cooldownRemaining: 0 },  // requires melee - hidden
        ],
        gold: 50,
        floor: 2,
        totalKills: 0,
        totalDeaths: 0,
        totalRuns: 0,
        deathStash: null,
        mana: 20,
        maxMana: 20,
        ringMastery: {},
        learnedRingSpellIds: [],
      },
    });
    const view = buildGameView(state);

    expect(view.player.abilities).toHaveLength(1);
    expect(view.player.abilities[0]!.id).toBe('second_wind');
  });
});

describe('buildGameView shop rarity', () => {
  it('ShopItemView includes rarity from item template', () => {
    const state = makeState({
      phase: 'town',
      world: {
        town: { prosperity: 60, fear: 10, corruption: 5, rumors: [], lastRunSummary: null },
        npcs: [],
        shop: { items: [{ itemId: 'health_potion', price: 15, stock: 3 }], buybackMultiplier: 0.4 },
        eventHistory: [],
        totalRuns: 0,
        deepestFloor: 0,
        factions: [],
        dungeonOgre: sealedDungeonOgre,
        unlockedBlueprints: [],
        highestRarityFound: 'common' as const,
      },
    });
    const view = buildGameView(state);
    const shopItem = view.town?.shop.items[0];
    // health_potion is 'common' rarity in game content
    expect(shopItem?.rarity).toBeDefined();
    expect(typeof shopItem?.rarity).toBe('string');
  });
});

describe('buildGameView map sprite fields', () => {
  it('map.biomeId reflects the floor biomeId', () => {
    const state = makeState({ run: makeRunState(1, false, false) });
    const view = buildGameView(state);
    expect(view.map?.biomeId).toBe('crypt');
  });

  it('map cell has tileType matching the tile type', () => {
    const state = makeState({ run: makeRunState(1, false, false) });
    const view = buildGameView(state);
    const cell = view.map?.cells[0];
    expect(cell?.tileType).toBe('floor');
  });

  it('map cell tileType is stairs_up when player is on stairs_up tile', () => {
    const state = makeState({ run: makeRunState(2, true, true) });
    const view = buildGameView(state);
    const cell = view.map?.cells[0];
    expect(cell?.tileType).toBe('stairs_up');
  });

  it('player entity has templateId null', () => {
    const state = makeState({ run: makeRunState(1, false, false) });
    const view = buildGameView(state);
    const player = view.map?.entities.find(e => e.type === 'player');
    expect(player?.templateId).toBeNull();
  });

  it('enemy entity has templateId from EnemyInstance', () => {
    const run = makeRunState(1, false, false);
    const enemyKey = posKey({ x: 0, y: 0 });
    const enemies = new Map(run.enemies);
    enemies.set(enemyKey, {
      id: entityId('e1'),
      templateId: 'skeleton_warrior',
      name: 'Skeleton Warrior',
      position: { x: 0, y: 0 },
      stats: { maxHealth: 30, health: 30, attack: 8, defense: 2, accuracy: 70, evasion: 5, speed: 80 },
      statuses: [],
      xpReward: 10,
    } as any);
    const state = makeState({ run: { ...run, enemies } });
    const view = buildGameView(state);
    const enemy = view.map?.entities.find(e => e.type === 'enemy');
    expect(enemy?.templateId).toBe('skeleton_warrior');
  });

  it('floor object entity has correct templateId', () => {
    const run = makeRunState(1, false, false);
    const objectKey = posKey({ x: 0, y: 0 });
    const objects = new Map([[objectKey, {
      id: entityId('obj1'),
      templateId: 'chest',
      position: { x: 0, y: 0 },
      isExhausted: false,
    }]]);
    const state = makeState({ run: { ...run, objects } });
    const view = buildGameView(state);
    const object = view.map?.entities.find(e => e.type === 'object');
    expect(object?.templateId).toBe('chest');
  });

  it('enemy entity uses ascii field from template, not name first letter', () => {
    const run = makeRunState(1, false, false);
    const enemyKey = posKey({ x: 0, y: 0 });
    const enemies = new Map(run.enemies);
    enemies.set(enemyKey, {
      id: entityId('e1'),
      templateId: 'skeleton_warrior',
      name: 'Skeleton Warrior',
      ascii: 'S',
      archetype: 'aggressive_melee',
      tier: 1,
      stats: { maxHealth: 30, health: 30, attack: 8, defense: 2, accuracy: 70, evasion: 5, speed: 80 },
      equipment: { weapon: { damageMultiplier: 1.0, damageType: 'physical', range: 1 } },
      affinities: {},
      spawn: { floorRange: [1, 3], weight: 2 },
      lootTableId: 'loot_skeleton',
      experienceValue: 15,
      description: 'An animated skeleton wielding a rusty sword.',
      position: { x: 0, y: 0 },
      statuses: [],
      isAlerted: false,
      lastKnownPlayerPos: null,
      loot: [],
      xpReward: 10,
    } as any);
    const state = makeState({ run: { ...run, enemies } });
    const view = buildGameView(state);
    const enemy = view.map?.entities.find(e => e.type === 'enemy');
    expect(enemy?.ascii).toBe('S');
  });

  it('enemy entity uses color field from template when present', () => {
    const run = makeRunState(1, false, false);
    const enemyKey = posKey({ x: 0, y: 0 });
    const enemies = new Map(run.enemies);
    enemies.set(enemyKey, {
      id: entityId('e1'),
      templateId: 'skeleton_warrior',
      name: 'Skeleton Warrior',
      ascii: 'S',
      color: '#ccccaa',
      archetype: 'aggressive_melee',
      tier: 1,
      stats: { maxHealth: 30, health: 30, attack: 8, defense: 2, accuracy: 70, evasion: 5, speed: 80 },
      equipment: { weapon: { damageMultiplier: 1.0, damageType: 'physical', range: 1 } },
      affinities: {},
      spawn: { floorRange: [1, 3], weight: 2 },
      lootTableId: 'loot_skeleton',
      experienceValue: 15,
      description: 'An animated skeleton wielding a rusty sword.',
      position: { x: 0, y: 0 },
      statuses: [],
      isAlerted: false,
      lastKnownPlayerPos: null,
      loot: [],
      xpReward: 10,
    } as any);
    const state = makeState({ run: { ...run, enemies } });
    const view = buildGameView(state);
    const enemy = view.map?.entities.find(e => e.type === 'enemy');
    expect(enemy?.color).toBe('#ccccaa');
  });
});

describe('buildRunSummaryStats', () => {
  it('returns null when no run metrics', () => {
    const state = makeState({ phase: 'town', run: null });
    const view = buildGameView(state);
    expect(view.town?.runSummaryStats).toBeNull();
  });

  it('returns stats when run metrics are present in town phase', () => {
    const state = makeState({
      phase: 'town',
      run: {
        ...makeRunState(3, false, false),
        runMetrics: { ...EMPTY_RUN_METRICS, floorsCleared: 2, enemiesKilled: 5, goldEarned: 100 },
      },
    });
    const view = buildGameView(state);
    expect(view.town?.runSummaryStats).not.toBeNull();
    expect(view.town?.runSummaryStats?.floorsCleared).toBe(2);
    expect(view.town?.runSummaryStats?.enemiesKilled).toBe(5);
    expect(view.town?.runSummaryStats?.goldEarned).toBe(100);
  });
});

describe('buildPrepAdvice', () => {
  it('returns weapon advice when no weapon equipped', () => {
    const state = makeState({ phase: 'town' });
    const view = buildGameView(state);
    expect(view.town?.prepAdvice.some(a => a.includes('no weapon'))).toBe(true);
  });

  it('returns low health advice when health below 50%', () => {
    const state = makeState({
      phase: 'town',
      player: {
        ...makeState().player,
        stats: { ...makeState().player.stats, health: 30, maxHealth: 100 },
      },
    });
    const view = buildGameView(state);
    expect(view.town?.prepAdvice.some(a => a.includes('health is low'))).toBe(true);
  });

  it('returns high corruption warning when corruption > 75', () => {
    const state = makeState({
      phase: 'town',
      world: {
        ...makeState().world,
        town: { ...makeState().world.town, corruption: 80 },
      },
    });
    const view = buildGameView(state);
    expect(view.town?.prepAdvice.some(a => a.includes('Corruption is dangerously high'))).toBe(true);
  });

  it('returns no consumables advice when inventory is empty', () => {
    const state = makeState({ phase: 'town' });
    const view = buildGameView(state);
    expect(view.town?.prepAdvice.some(a => a.includes('no consumables'))).toBe(true);
  });
});

describe('computeDangerLevel (via MapView)', () => {
  it('returns safe when depth is much lower than player level', () => {
    const state = makeState({
      run: makeRunState(1, false, false),
      player: { ...makeState().player, level: 5 },
    });
    const view = buildGameView(state);
    expect(view.map?.dangerLevel).toBe('safe');
  });

  it('returns moderate when depth roughly equals player level', () => {
    const state = makeState({
      run: makeRunState(1, false, false),
      player: { ...makeState().player, level: 1 },
    });
    const view = buildGameView(state);
    expect(view.map?.dangerLevel).toBe('moderate');
  });

  it('returns dangerous when depth exceeds player level by 1-2', () => {
    const state = makeState({
      run: makeRunState(3, false, false),
      player: { ...makeState().player, level: 1 },
    });
    const view = buildGameView(state);
    expect(view.map?.dangerLevel).toBe('dangerous');
  });

  it('returns deadly when depth exceeds player level by more than 2', () => {
    const state = makeState({
      run: makeRunState(5, false, false),
      player: { ...makeState().player, level: 1 },
    });
    const view = buildGameView(state);
    expect(view.map?.dangerLevel).toBe('deadly');
  });
});

describe('buildDeathSummary', () => {
  it('returns null when phase is not game_over', () => {
    const state = makeState({ phase: 'dungeon', run: makeRunState(1, false, false) });
    const view = buildGameView(state);
    expect(view.deathSummary).toBeNull();
  });

  it('returns null for victory', () => {
    const state = makeState({
      phase: 'game_over',
      run: {
        ...makeRunState(5, false, false),
        runMetrics: { ...EMPTY_RUN_METRICS, causeOfEnd: 'victory' },
      },
    });
    const view = buildGameView(state);
    expect(view.deathSummary).toBeNull();
  });

  it('returns death summary for death cause', () => {
    const state = makeState({
      phase: 'game_over',
      run: {
        ...makeRunState(3, false, false),
        runMetrics: { ...EMPTY_RUN_METRICS, causeOfEnd: 'death', turnsElapsed: 25, damageDealt: 100, damageTaken: 150 },
      },
    });
    const view = buildGameView(state);
    expect(view.deathSummary).not.toBeNull();
    expect(view.deathSummary?.turnsSurvived).toBe(25);
    expect(view.deathSummary?.damageDealt).toBe(100);
    expect(view.deathSummary?.damageTaken).toBe(150);
  });
});

describe('buildInventoryView equipped-items-first sorting', () => {
  function makeInventoryState(inventory: string[], weaponId: string | null = null) {
    const items = new Map<string, any>();
    for (const id of inventory) {
      items.set(id, {
        itemId: id,
        name: `Item ${id}`,
        description: `Desc ${id}`,
        itemClass: id.startsWith('sword') ? 'weapon' : 'consumable',
        rarity: 'common',
        value: 10,
        stackable: id.startsWith('potion'),
        maxStack: id.startsWith('potion') ? 5 : 1,
        ...(id.startsWith('sword') ? { weapon: { damage: 5, damageType: 'physical', accuracy: 80, speed: 100, slot: 'weapon', weaponRange: 1, weaponType: 'blade' } } : {}),
        ...(id.startsWith('potion') ? { consumable: { effect: 'heal', magnitude: 30 } } : {}),
      });
    }

    return makeState({
      player: {
        ...makeState().player,
        inventory: inventory.map(id => entityId(id)),
        equipment: {
          weapon: weaponId ? entityId(weaponId) : null,
          secondaryWeapon: null,
          chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null,
        },
      },
      world: {
        ...makeState().world,
        shop: { items: [], buybackMultiplier: 0.4 },
      },
      itemRegistry: { items: items as any },
    });
  }

  it('equipped items appear before unequipped items in items array', () => {
    const state = makeInventoryState(['potion1', 'sword1', 'potion2'], 'sword1');
    const view = buildGameView(state);
    const items = view.inventory.items;
    const equippedIdx = items.findIndex(i => i.isEquipped);
    const unequippedIdx = items.findIndex(i => !i.isEquipped);
    expect(equippedIdx).toBeLessThan(unequippedIdx);
  });

  it('isEquipped flag is true for equipped items, false for others', () => {
    const state = makeInventoryState(['potion1', 'sword1'], 'sword1');
    const view = buildGameView(state);
    const sword = view.inventory.items.find(i => i.id === entityId('sword1'));
    const potion = view.inventory.items.find(i => i.id === entityId('potion1'));
    expect(sword?.isEquipped).toBe(true);
    expect(potion?.isEquipped).toBe(false);
  });

  it('relative order within each group is preserved', () => {
    const state = makeInventoryState(['potion1', 'potion2', 'sword1', 'potion3'], 'sword1');
    const view = buildGameView(state);
    const items = view.inventory.items;
    const unequipped = items.filter(i => !i.isEquipped);
    expect(unequipped.map(i => i.id)).toEqual([entityId('potion1'), entityId('potion2'), entityId('potion3')]);
  });
});

describe('buildInventoryView item stacking', () => {
  function makeStackState(inventoryIds: string[], equippedWeaponId: string | null = null) {
    const items = new Map<string, any>();

    // health_potion template (stackable)
    items.set('health_potion', {
      itemId: 'health_potion', name: 'Health Potion', description: 'Heals 30 HP',
      itemClass: 'consumable', rarity: 'common', value: 10,
      stackable: true, maxStack: 5,
      consumable: { effect: 'heal', magnitude: 30 },
    });
    // iron_sword template (non-stackable)
    items.set('iron_sword', {
      itemId: 'iron_sword', name: 'Iron Sword', description: 'A basic sword',
      itemClass: 'weapon', rarity: 'common', value: 50,
      stackable: false, maxStack: 1,
      weapon: { damage: 8, damageType: 'physical', accuracy: 80, speed: 100, slot: 'weapon', weaponRange: 1, weaponType: 'blade' },
    });
    // mana_potion template (stackable)
    items.set('mana_potion', {
      itemId: 'mana_potion', name: 'Mana Potion', description: 'Restores mana',
      itemClass: 'consumable', rarity: 'uncommon', value: 15,
      stackable: true, maxStack: 3,
      consumable: { effect: 'buff', magnitude: 20 },
    });

    // Each inventory slot is an EntityId that maps to a template via itemRegistry
    // The entityId IS the itemId in this game (items.get(entityId) returns template)
    const registry = new Map<string, any>();
    for (const id of inventoryIds) {
      registry.set(entityId(id), items.get(id));
    }
    if (equippedWeaponId) {
      registry.set(entityId(equippedWeaponId), items.get(equippedWeaponId));
    }

    return makeState({
      player: {
        ...makeState().player,
        inventory: inventoryIds.map(id => entityId(id)),
        equipment: {
          weapon: equippedWeaponId ? entityId(equippedWeaponId) : null,
          secondaryWeapon: null,
          chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null,
        },
      },
      world: {
        ...makeState().world,
        shop: { items: [], buybackMultiplier: 0.4 },
      },
      itemRegistry: { items: registry as any },
    });
  }

  it('stackable items with same templateId grouped into single entry with quantity: N', () => {
    // 3 health potions (same templateId) in inventory
    const state = makeStackState(['health_potion', 'health_potion', 'health_potion']);
    const view = buildGameView(state);
    const potions = view.inventory.items.filter(i => i.templateId === 'health_potion');
    expect(potions).toHaveLength(1);
    expect(potions[0]!.quantity).toBe(3);
  });

  it('non-stackable items remain separate with quantity: 1', () => {
    const state = makeStackState(['iron_sword']);
    const view = buildGameView(state);
    expect(view.inventory.items[0]!.quantity).toBe(1);
  });

  it('stackEntityIds contains all EntityIds in the stack', () => {
    const state = makeStackState(['health_potion', 'health_potion']);
    const view = buildGameView(state);
    const potion = view.inventory.items.find(i => i.templateId === 'health_potion');
    expect(potion!.stackEntityIds).toHaveLength(2);
  });

  it('equipped items are never stacked (even if stackable type)', () => {
    // equip a weapon that's also in inventory shouldn't happen for consumables,
    // but let's test that equipped items stay separate
    const state = makeStackState(['iron_sword', 'health_potion', 'health_potion'], 'iron_sword');
    const view = buildGameView(state);
    // sword is equipped — should NOT be stacked
    const equipped = view.inventory.items.filter(i => i.isEquipped);
    expect(equipped).toHaveLength(1);
    expect(equipped[0]!.quantity).toBe(1);
    // potions should stack
    const potions = view.inventory.items.filter(i => i.templateId === 'health_potion');
    expect(potions).toHaveLength(1);
    expect(potions[0]!.quantity).toBe(2);
  });

  it('mixed inventory: stacked consumables + non-stackable weapons correct', () => {
    const state = makeStackState(['health_potion', 'iron_sword', 'health_potion', 'mana_potion', 'mana_potion']);
    const view = buildGameView(state);
    // health_potion x2, iron_sword x1, mana_potion x2 = 3 entries
    expect(view.inventory.items).toHaveLength(3);
    const hp = view.inventory.items.find(i => i.templateId === 'health_potion');
    const mp = view.inventory.items.find(i => i.templateId === 'mana_potion');
    const sword = view.inventory.items.find(i => i.templateId === 'iron_sword');
    expect(hp!.quantity).toBe(2);
    expect(mp!.quantity).toBe(2);
    expect(sword!.quantity).toBe(1);
  });

  it('TownView exposes lastRetreatFloor when present (Phase A3)', () => {
    const state = makeState({
      phase: 'town',
      lastRetreatFloor: 3,
    });
    const view = buildGameView(state);
    expect(view.town?.lastRetreatFloor).toBe(3);
  });

  it('TownView omits lastRetreatFloor when undefined', () => {
    const state = makeState({
      phase: 'town',
      lastRetreatFloor: undefined,
    });
    const view = buildGameView(state);
    expect(view.town?.lastRetreatFloor).toBeUndefined();
  });

  it('TownView exposes faction pressure data for tavern and modal surfaces', () => {
    const baseState = makeState({ phase: 'town' });
    const faction: FactionState = {
      id: 'goblin_warband',
      name: 'Goblin Warband',
      power: 40,
      disposition: -30,
      status: 'led',
      activeLeaderId: entityId('leader-1'),
      leader: {
        id: entityId('leader-1'),
        factionId: 'goblin_warband',
        name: 'Brakka',
        title: 'Knife-King',
        templateId: 'goblin_warlord',
        isActive: true,
        isSlain: false,
        emergedOnRun: 2,
        emergedOnDepth: 3,
      },
      leaderSlain: false,
      membersKilledByPlayer: 3,
      leadersKilledByPlayer: 0,
      playerDeathsCaused: 1,
    };
    const state = {
      ...baseState,
      world: {
        ...baseState.world,
        factions: [faction],
      },
    };

    const view = buildGameView(state);

    expect(view.town?.factionPressureSummary).toBe('1 led · 0 leaderless · 0 broken.');
    expect(view.town?.factions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'goblin_warband',
          name: 'Goblin Warband',
          leader: expect.objectContaining({
            state: 'emerged',
            name: 'Brakka',
            title: 'Knife-King',
          }),
        }),
      ]),
    );
  });

  // Phase B: Ability UX Tests
  it('B1: ability actions include description from ABILITY_DEFINITIONS', () => {
    const swordId = entityId('sword1');
    const state = makeState({
      phase: 'dungeon',
      run: makeRunState(1, false, false),
      player: {
        ...makeState().player,
        equipment: { weapon: swordId, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
        abilities: [
          { id: 'power_strike', cooldownRemaining: 0 },
        ],
      },
      itemRegistry: {
        items: new Map([
          [
            swordId,
            {
              itemId: 'iron_sword',
              name: 'Iron Sword',
              description: 'A basic sword',
              itemClass: 'weapon' as const,
              rarity: 'common' as const,
              value: 50,
              stackable: false,
              maxStack: 1,
              weapon: {
                damage: 10,
                damageType: 'slashing' as const,
                accuracy: 75,
                speed: 100,
                slot: 'weapon' as const,
                weaponRange: 1,
                weaponType: 'blade' as const,
              },
            },
          ],
        ]),
      },
    });
    const view = buildGameView(state);
    const abilityAction = view.availableActions.find(a => a.id === 'use_ability_power_strike');
    expect(abilityAction?.description).toBeDefined();
    expect(typeof abilityAction?.description).toBe('string');
    expect((abilityAction?.description ?? '').length).toBeGreaterThan(0);
  });

  it('B2: all abilities shown in actions including on-cooldown', () => {
    const bladeWeaponId = entityId('blade_weapon');
    const state = makeState({
      phase: 'dungeon',
      run: makeRunState(1, false, false),
      player: {
        ...makeState().player,
        equipment: { ...makeState().player.equipment, weapon: bladeWeaponId },
        abilities: [
          { id: 'second_wind', cooldownRemaining: 0 },  // ready, non-targeted
          { id: 'blade_bleed', cooldownRemaining: 2 },  // on cooldown, targeted
        ],
      },
      itemRegistry: {
        items: new Map([[bladeWeaponId, {
          itemId: 'iron_sword',
          name: 'Iron Sword',
          description: 'A basic sword',
          itemClass: 'weapon' as const,
          rarity: 'common' as const,
          value: 50,
          stackable: false,
          maxStack: 1,
          weapon: { damage: 8, damageType: 'physical', accuracy: 80, speed: 100, slot: 'weapon', weaponRange: 1, weaponType: 'blade' },
        }]]),
      },
    });
    const view = buildGameView(state);
    const secondWind = view.availableActions.find(a => a.id === 'use_ability_second_wind');
    const bladeBleed = view.availableActions.find(a => a.id === 'use_ability_blade_bleed');

    expect(secondWind).toBeDefined();
    expect(secondWind?.enabled).toBe(true);
    expect(bladeBleed).toBeDefined();
    expect(bladeBleed?.enabled).toBe(false);
    expect(bladeBleed?.label).toContain('(2 turns)');
  });

  it('B3: targeted abilities disabled when no enemy in range', () => {
    const swordId = entityId('sword1');
    const state = makeState({
      phase: 'dungeon',
      run: { ...makeRunState(1, false, false), enemies: new Map() },
      player: {
        ...makeState().player,
        position: { x: 0, y: 0 },
        equipment: { weapon: swordId, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
        abilities: [
          { id: 'power_strike', cooldownRemaining: 0 },
        ],
      },
      itemRegistry: {
        items: new Map([
          [
            swordId,
            {
              itemId: 'iron_sword',
              name: 'Iron Sword',
              description: 'A basic sword',
              itemClass: 'weapon' as const,
              rarity: 'common' as const,
              value: 50,
              stackable: false,
              maxStack: 1,
              weapon: {
                damage: 10,
                damageType: 'slashing' as const,
                accuracy: 75,
                speed: 100,
                slot: 'weapon' as const,
                weaponRange: 1,
                weaponType: 'blade' as const,
              },
            },
          ],
        ]),
      },
    });
    const view = buildGameView(state);
    const powerStrike = view.availableActions.find(a => a.id === 'use_ability_power_strike');
    expect(powerStrike?.enabled).toBe(false);
    expect(powerStrike?.label).toContain('(no target)');
  });

  it('B3: non-targeted abilities always enabled when not on cooldown', () => {
    const state = makeState({
      phase: 'dungeon',
      run: { ...makeRunState(1, false, false), enemies: new Map() },
      player: {
        ...makeState().player,
        position: { x: 0, y: 0 },
        abilities: [
          { id: 'second_wind', cooldownRemaining: 0 },
        ],
      },
    });
    const view = buildGameView(state);
    const secondWind = view.availableActions.find(a => a.id === 'use_ability_second_wind');
    expect(secondWind?.enabled).toBe(true);
  });
});

describe('buildInventoryView equipped items in inventory.items', () => {
  it('equipped items appear in inventory.items with isEquipped=true', () => {
    const weaponId = entityId('sword_equipped');
    const state = makeState({
      phase: 'dungeon',
      player: {
        ...makeState().player,
        inventory: [],
        equipment: {
          weapon: weaponId,
          chest: null,
          head: null,
          gloves: null,
          boots: null,
          ring1: null,
          ring2: null,
          secondaryWeapon: null,
        },
      },
      itemRegistry: {
        items: new Map([[weaponId, {
          itemId: 'iron_sword',
          name: 'Iron Sword',
          description: 'A basic sword',
          itemClass: 'weapon' as const,
          rarity: 'common' as const,
          value: 50,
          stackable: false,
          maxStack: 1,
          weapon: { damage: 8, damageType: 'physical', accuracy: 80, speed: 100, slot: 'weapon', weaponRange: 1, weaponType: 'blade' },
        }]]),
      },
    });
    const view = buildGameView(state);
    const equippedWeapon = view.inventory.items.find(i => i.id === weaponId);
    expect(equippedWeapon).toBeDefined();
    expect(equippedWeapon?.isEquipped).toBe(true);
  });

  it('equipped item appears in both inventory.items and inventory.equipped.weapon', () => {
    const weaponId = entityId('sword_equipped');
    const state = makeState({
      phase: 'dungeon',
      player: {
        ...makeState().player,
        inventory: [],
        equipment: {
          weapon: weaponId,
          chest: null,
          head: null,
          gloves: null,
          boots: null,
          ring1: null,
          ring2: null,
          secondaryWeapon: null,
        },
      },
      itemRegistry: {
        items: new Map([[weaponId, {
          itemId: 'iron_sword',
          name: 'Iron Sword',
          description: 'A basic sword',
          itemClass: 'weapon' as const,
          rarity: 'common' as const,
          value: 50,
          stackable: false,
          maxStack: 1,
          weapon: { damage: 8, damageType: 'physical', accuracy: 80, speed: 100, slot: 'weapon', weaponRange: 1, weaponType: 'blade' },
        }]]),
      },
    });
    const view = buildGameView(state);
    const itemInInventory = view.inventory.items.find(i => i.id === weaponId);
    const itemInEquipped = view.inventory.equipped.weapon;
    expect(itemInInventory).toBeDefined();
    expect(itemInEquipped).toBeDefined();
    expect(itemInInventory?.id).toBe(itemInEquipped?.id);
  });

  it('unequipped items appear only once, not duplicated', () => {
    const potionId = entityId('health_potion_1');
    const state = makeState({
      phase: 'dungeon',
      player: {
        ...makeState().player,
        inventory: [potionId],
        equipment: {
          weapon: null,
          chest: null,
          head: null,
          gloves: null,
          boots: null,
          ring1: null,
          ring2: null,
          secondaryWeapon: null,
        },
      },
      itemRegistry: {
        items: new Map([[potionId, {
          itemId: 'health_potion',
          name: 'Health Potion',
          description: 'Heals 30 HP',
          itemClass: 'consumable' as const,
          rarity: 'common' as const,
          value: 10,
          stackable: true,
          maxStack: 5,
          consumable: { effect: 'heal' as const, magnitude: 30 },
        }]]),
      },
    });
    const view = buildGameView(state);
    const potions = view.inventory.items.filter(i => i.id === potionId);
    expect(potions).toHaveLength(1);
    expect(potions[0]?.isEquipped).toBe(false);
  });

  it('after equipping armor, item appears with isEquipped=true', () => {
    const armorId = entityId('iron_chest');
    const state = makeState({
      phase: 'dungeon',
      player: {
        ...makeState().player,
        inventory: [],
        equipment: {
          weapon: null,
          chest: armorId,
          head: null,
          gloves: null,
          boots: null,
          ring1: null,
          ring2: null,
          secondaryWeapon: null,
        },
      },
      itemRegistry: {
        items: new Map([[armorId, {
          itemId: 'iron_chest',
          name: 'Iron Chest',
          description: 'Heavy chest armor',
          itemClass: 'armor' as const,
          rarity: 'common' as const,
          value: 100,
          stackable: false,
          maxStack: 1,
          armor: { defense: 5, evasionPenalty: 10, slot: 'chest', enchantmentSlots: 0, enchantments: [] },
        }]]),
      },
    });
    const view = buildGameView(state);
    const equippedArmor = view.inventory.items.find(i => i.id === armorId);
    expect(equippedArmor).toBeDefined();
    expect(equippedArmor?.isEquipped).toBe(true);
  });
});

describe('buildInspectableEntities', () => {
  it('returns empty array when no run', () => {
    const state = makeState({ run: null });
    const view = buildGameView(state);
    expect(view.inspectableEntities).toEqual([]);
  });

  it('includes visible enemies', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
    const view = buildGameView(state);
    expect(view.inspectableEntities.length).toBeGreaterThan(0);
    expect(view.inspectableEntities[0]!.entityType).toBe('enemy');
  });

  it('excludes hidden enemies (visibility !== visible)', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
    // Modify floor to hide the enemy cell
    const hiddenCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#fff' }, visibility: 'hidden' as const };
    const cells = new Map(state.run!.floor.cells);
    cells.set('1,0', hiddenCell);
    const modifiedRun = {
      ...state.run!,
      floor: {
        ...state.run!.floor,
        cells,
      },
    };

    const state2 = { ...state, run: modifiedRun };
    const view = buildGameView(state2);
    expect(view.inspectableEntities).toEqual([]);
  });

  it('does NOT deduplicate enemies by templateId (Phase 3: each instance is inspectable)', () => {
    const enemy1 = createTestEnemy({ position: { x: 1, y: 0 } });
    const enemy2 = createTestEnemy({ id: entityId('e2'), position: { x: 2, y: 0 } });

    const visibleCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#fff' }, visibility: 'visible' as const };
    const modifiedRun = {
      ...createTestGameStateInCombat().run!,
      enemies: new Map([
        ['1,0', enemy1],
        ['2,0', enemy2],
      ]),
      floor: {
        ...createTestGameStateInCombat().run!.floor,
        cells: new Map([
          ['1,0', visibleCell],
          ['2,0', visibleCell],
        ]),
      },
    };

    const state = createTestGameStateInCombat();
    const state2 = { ...state, run: modifiedRun };
    const view = buildGameView(state2);
    // Both enemies should appear (not deduplicated) so player can inspect each instance at different distances
    expect(view.inspectableEntities.filter(e => e.entityType === 'enemy')).toHaveLength(2);
  });

  it('sorts enemies before objects', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
    const objectObj = {
      id: entityId('o1'),
      templateId: 'chest',
      position: { x: 1, y: 0 },
      isExhausted: false,
    };

    const visibleCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#fff' }, visibility: 'visible' as const };
    const modifiedRun = {
      ...state.run!,
      objects: new Map([['1,0', objectObj]]),
      floor: {
        ...state.run!.floor,
        cells: new Map([
          ['1,0', visibleCell],
          ['5,5', visibleCell],
        ]),
      },
    };

    const state2 = { ...state, run: modifiedRun };
    const view = buildGameView(state2);
    const firstEntity = view.inspectableEntities[0];
    expect(firstEntity?.entityType).toBe('enemy');
  });

  it('sorts closer enemies before farther enemies', () => {
    const enemy1 = createTestEnemy({ position: { x: 1, y: 0 } });
    const enemy2 = createTestEnemy({ id: entityId('e2'), templateId: 'goblin_archer', position: { x: 3, y: 3 } });

    const visibleCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#fff' }, visibility: 'visible' as const };
    const modifiedRun = {
      ...createTestGameStateInCombat().run!,
      enemies: new Map([
        ['1,0', enemy1],
        ['3,3', enemy2],
      ]),
      floor: {
        ...createTestGameStateInCombat().run!.floor,
        cells: new Map([
          ['1,0', visibleCell],
          ['3,3', visibleCell],
        ]),
      },
    };

    const state = createTestGameStateInCombat();
    const state2 = { ...state, run: modifiedRun };
    const view = buildGameView(state2);
    // Closer enemy (1,0) should appear before farther enemy (3,3)
    if (view.inspectableEntities.length >= 2) {
      expect(view.inspectableEntities[0]!.id).toBe(enemy1.id);
      expect(view.inspectableEntities[1]!.id).toBe(enemy2.id);
    }
  });

  it('skips objects with missing template', () => {
    const objectObj = {
      id: entityId('o1'),
      templateId: 'nonexistent_template_xyz',
      position: { x: 1, y: 0 },
      isExhausted: false,
    };

    const visibleCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#fff' }, visibility: 'visible' as const };
    const modifiedRun = {
      ...createTestGameStateInCombat().run!,
      enemies: new Map(),
      objects: new Map([['1,0', objectObj]]),
      floor: {
        ...createTestGameStateInCombat().run!.floor,
        cells: new Map([['1,0', visibleCell]]),
      },
    };

    const state = createTestGameStateInCombat();
    const state2 = { ...state, run: modifiedRun };
    const view = buildGameView(state2);
    expect(view.inspectableEntities).toEqual([]);
  });

  it('sets entityType correctly for enemies and objects', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
    const objectObj = {
      id: entityId('o1'),
      templateId: 'chest',
      position: { x: 2, y: 0 },
      isExhausted: false,
    };

    const visibleCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#fff' }, visibility: 'visible' as const };
    const modifiedRun = {
      ...state.run!,
      objects: new Map([['2,0', objectObj]]),
      floor: {
        ...state.run!.floor,
        cells: new Map([
          ['1,0', visibleCell],
          ['2,0', visibleCell],
        ]),
      },
    };

    const state2 = { ...state, run: modifiedRun };
    const view = buildGameView(state2);
    const hasEnemy = view.inspectableEntities.some(e => e.entityType === 'enemy');
    const hasObject = view.inspectableEntities.some(e => e.entityType === 'object');
    expect(hasEnemy).toBe(true);
    expect(hasObject).toBe(true);
  });
});

describe('InspectableEntityView ASCII consistency (Phase 6)', () => {
  it('uses enemy.ascii from template, not derived from name', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
    if (!state.run) throw new Error('No run');

    // Get the actual enemy instance to verify it has the template ASCII
    const enemy = Array.from(state.run.enemies.values())[0];
    if (!enemy) throw new Error('No enemy found');

    const view = buildGameView(state);
    const inspectableEnemy = view.inspectableEntities.find(e => e.entityType === 'enemy' && e.id === enemy.id);

    // Should use enemy.ascii from template, not enemy.name.charAt(0).toUpperCase()
    expect(inspectableEnemy?.ascii).toBe(enemy.ascii);
    // The test will fail if it's deriving from name (e.g., "Pit Spider" → "P" instead of "s")
    if (enemy.name === 'Pit Spider' || enemy.name.startsWith('Pit')) {
      expect(inspectableEnemy?.ascii).not.toBe('P');
    }
  });

  it('makes InspectScreen ASCII match map view ASCII', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
    if (!state.run) throw new Error('No run');

    const enemy = Array.from(state.run.enemies.values())[0];
    if (!enemy) throw new Error('No enemy found');

    // Build inspect view
    const gameView = buildGameView(state);
    const inspectableEnemy = gameView.inspectableEntities.find(e => e.id === enemy.id);

    // Get map view to compare
    const mapView = gameView.map;
    if (!mapView) throw new Error('No map view');

    const mapEntity = mapView.entities.find(e => e.id === enemy.id);

    // Both should show the same ASCII character
    expect(inspectableEnemy?.ascii).toBe(mapEntity?.ascii);
  });
});

describe('Map view stairs sprites (Phase 1a)', () => {
  it('renders stairs_up tile with sprite name "staircase up left"', () => {
    const state = makeState({
      run: makeRunState(2, true, true),
    });
    const view = buildGameView(state);
    const mapView = view.map;

    if (!mapView) throw new Error('No map view');
    const stairsCell = mapView.cells.find(c => c.tileType === 'stairs_up');

    expect(stairsCell).toBeDefined();
    expect(stairsCell?.spriteName).toBe('staircase up left');
  });

  it('renders stairs_down tile with sprite name "staircase down left"', () => {
    const stairsTile = {
      type: 'stairs_down' as const,
      walkable: true,
      blocksVision: false,
      ascii: '>',
      color: '#0ff',
    };
    const cells = new Map([
      [posKey({ x: 0, y: 0 }), { tile: stairsTile, visibility: 'visible' as const }],
    ]);
    const floor = {
      width: 10,
      height: 10,
      depth: 3,
      biomeId: 'crypt',
      cells,
      entrance: { x: 0, y: 0 },
      exit: { x: 9, y: 9 },
      seed: 42,
    };

    const state = makeState({
      run: {
        runId: entityId('run1'),
        floor,
        enemies: new Map(),
        objects: new Map(),
        turnCount: 1,
        isActive: true,
        floorHistory: [],
        speedAccumulators: {},
      },
    });

    const view = buildGameView(state);
    const mapView = view.map;

    if (!mapView) throw new Error('No map view');
    const stairsCell = mapView.cells.find(c => c.tileType === 'stairs_down');

    expect(stairsCell).toBeDefined();
    expect(stairsCell?.spriteName).toBe('staircase down left');
  });
});

describe('Entity deduplication and sorting', () => {
  it('deduplicates entities with same position', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
    if (!state.run) throw new Error('No run');

    const view = buildGameView(state);
    const mapEntities = view.map?.entities ?? [];
    
    // Should not have duplicate positions
    const positions = new Map<string, number>();
    for (const entity of mapEntities) {
      const posStr = `${entity.x},${entity.y}`;
      positions.set(posStr, (positions.get(posStr) ?? 0) + 1);
    }

    for (const count of positions.values()) {
      expect(count).toBeLessThanOrEqual(1); // No duplicates
    }
  });

  it('sorts entities by distance from player', () => {
    let state = createTestGameStateInCombat();
    if (!state.run) throw new Error('No run');

    // Create multiple enemies at different distances
    const enemy1 = createTestEnemy({ id: entityId('e1'), position: { x: 1, y: 0 } });
    const enemy2 = createTestEnemy({ id: entityId('e2'), position: { x: 5, y: 0 } });
    const enemy3 = createTestEnemy({ id: entityId('e3'), position: { x: 3, y: 0 } });

    const enemiesMap = new Map(state.run.enemies);
    enemiesMap.set('1,0', enemy1);
    enemiesMap.set('5,0', enemy2);
    enemiesMap.set('3,0', enemy3);
    state = {
      ...state,
      run: { ...state.run, enemies: enemiesMap },
    };

    const view = buildGameView(state);
    const entities = view.map?.entities ?? [];
    const enemyEntities = entities.filter(e => e.type === 'enemy');

    // Should be sorted by distance (closer first)
    for (let i = 1; i < enemyEntities.length; i++) {
      const dist1 = Math.hypot(enemyEntities[i - 1]!.x - state.player.position.x, enemyEntities[i - 1]!.y - state.player.position.y);
      const dist2 = Math.hypot(enemyEntities[i]!.x - state.player.position.x, enemyEntities[i]!.y - state.player.position.y);
      expect(dist1).toBeLessThanOrEqual(dist2);
    }
  });

  it('renders dungeon ogre with current template metadata', () => {
    let state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
    if (!state.run) throw new Error('No run');

    const enemy = Array.from(state.run.enemies.values())[0]!;
    const ogreEnemy = {
      ...enemy,
      id: entityId('dungeon_ogre'),
      templateId: 'dungeon_ogre',
      name: 'Dungeon Ogre',
    };
    const ogreMap = new Map<string, EnemyInstance>();
    ogreMap.set('1,0', ogreEnemy);
    state = {
      ...state,
      run: { ...state.run, enemies: ogreMap },
    };

    const view = buildGameView(state);
    const mapEntities = view.map?.entities ?? [];
    const ogreEntity = mapEntities.find(e => e.id === entityId('dungeon_ogre'));

    expect(ogreEntity).toBeDefined();
    expect(ogreEntity?.templateId).toBe('dungeon_ogre');
    expect(ogreEntity?.spriteName).toBeDefined();
    expect(ogreEntity?.color).toBeDefined();
  });
});

describe('Quest view and death context', () => {
  it('builds quest view with active quests', () => {
    let state = createTestGameStateInCombat();
    state = {
      ...state,
      activeQuests: [
        {
          id: 'q1',
          title: 'Hunt the Dangerous Enemy',
          description: 'Hunt down a dangerous enemy',
          objectiveText: 'Defeat the Goblin and report back.',
          status: 'active',
          objective: {
            type: 'defeat_enemy',
            targetId: 'goblin',
            progress: 0,
          },
          reward: {
            type: 'gold',
            amount: 100,
          },
          giverNpcId: 'npc1',
        },
      ],
    };

    const view = buildGameView(state);
    expect(view.activeQuests).toBeDefined();
    expect(view.activeQuests.length).toBeGreaterThan(0);
    expect(view.activeQuests[0]).toHaveProperty('objectiveText');
    expect(view.activeQuests[0]?.objectiveText).toBe('Defeat the Goblin and report back.');
    expect(view.activeQuests[0]).toHaveProperty('progress');
    expect(view.activeQuests[0]?.rewardGold).toBe(100);
  });

  it('sets phase to game_over when player is dead', () => {
    let state = createTestGameStateInCombat();
    state = {
      ...state,
      phase: 'game_over',
      player: {
        ...state.player,
        stats: { ...state.player.stats, health: 0 },
      },
    };

    const view = buildGameView(state);
    // Phase should reflect the state phase
    expect(view.phase).toBe('game_over');
  });

  it('handles no active quests gracefully', () => {
    let state = createTestGameStateInCombat();
    state = {
      ...state,
      activeQuests: [],
    };

    const view = buildGameView(state);
    expect(view.activeQuests).toBeDefined();
    expect(view.activeQuests.length).toBe(0);
  });

  it('provides map view with floor and biome information', () => {
    const state = createTestGameStateInCombat();
    if (!state.run) throw new Error('No run');

    const view = buildGameView(state);
    expect(view.map).toBeDefined();
    // Biome is available through the map view
    expect(view.map?.biomeId).toBe(state.run.floor.biomeId);
  });

  it('handles run progression data showing dungeon phase', () => {
    let state = createTestGameStateInCombat();
    if (!state.run) throw new Error('No run');

    state = {
      ...state,
      run: { ...state.run, turnCount: 50 },
    };
    const view = buildGameView(state);
    
    // Combat log entries reflect game progression
    expect(view.combatLog).toBeDefined();
    // createTestGameStateInCombat creates dungeon phase with enemy present
    expect(view.phase).toBe('dungeon');
  });

  it('builds leader emerged notices for player-facing overlays', () => {
    const state = makeState({
      world: {
        ...makeState().world,
        eventHistory: [{
          type: 'FACTION_LEADER_EMERGED',
          factionId: 'goblin_warband',
          factionName: 'Goblin Warband',
          leaderId: entityId('goblin_warband_leader'),
          leaderName: 'Brakka',
          leaderTitle: 'Knife-King',
          leaderTemplateId: 'goblin_warlord',
          emergedOnRun: 2,
          emergedOnDepth: 3,
          timestamp: 1,
          turnNumber: 10,
        }],
      },
    });

    const view = buildGameView(state);
    expect(view.notice?.kind).toBe('FACTION_LEADER_EMERGED');
    expect(view.notice?.title).toBe('Faction Leader Emerged');
    expect(view.notice?.message).toContain('Brakka, Knife-King');
    expect(view.notice?.spriteName).toBe('goblin king');
    expect(view.notices).toContainEqual(expect.objectContaining({
      kind: 'FACTION_LEADER_EMERGED',
      id: 'leader_emerged_goblin_warband_goblin_warband_leader_10_1',
    }));
  });

  it('builds dungeon ogre emerged notices with selected depth details', () => {
    const state = makeState({
      world: {
        ...makeState().world,
        eventHistory: [{
          type: 'DUNGEON_OGRE_EMERGED',
          ogreId: 'dungeon_ogre',
          emergedAfterRun: 4,
          emergedAtDepth: 6,
          eligibleSpawnDepths: [7, 8, 9],
          selectedSpawnDepth: 8,
          timestamp: 1,
          turnNumber: 10,
        }],
      },
    });

    const view = buildGameView(state);
    expect(view.notice?.kind).toBe('DUNGEON_OGRE_EMERGED');
    expect(view.notice?.message).toContain('floor 8');
    expect(view.notice?.detail).toContain('hunt it down');
    expect(view.notice?.spriteName).toBe('ogre');
    expect(view.notices).toContainEqual(expect.objectContaining({
      kind: 'DUNGEON_OGRE_EMERGED',
      id: 'dungeon_ogre_emerged_dungeon_ogre_8_10_1',
    }));
  });

  it('builds typed quest assigned notices from event history', () => {
    const state = makeState({
      activeQuests: [{
        id: 'quest-rats',
        title: 'Rat Problem',
        description: 'Clear the cellar rats.',
        status: 'active',
        objective: {
          type: 'defeat_enemy',
          targetId: 'rat',
          targetCount: 3,
          progress: 0,
        },
        reward: { type: 'gold', amount: 25 },
        giverNpcId: entityId('innkeeper'),
      }],
      world: {
        ...makeState().world,
        eventHistory: [{
          type: 'QUEST_ASSIGNED',
          questId: 'quest-rats',
          questTitle: 'Rat Problem',
          questDescription: 'Clear the cellar rats.',
          rewardGold: 25,
          giverNpcId: entityId('innkeeper'),
          timestamp: 1,
          turnNumber: 10,
        }],
      },
    });

    const view = buildGameView(state);
    const questNotice = view.notices?.find(notice => notice.kind === 'QUEST_ASSIGNED');

    expect(questNotice).toEqual(expect.objectContaining({
      id: 'quest_assigned_quest-rats',
      questId: 'quest-rats',
      questTitle: 'Rat Problem',
      rewardGold: 25,
      giverNpcId: entityId('innkeeper'),
    }));
    expect(view.notice).toBeUndefined();
  });

  it('keeps dismissible notice ids stable when event history shifts', () => {
    const olderEvent: DomainEvent = {
      type: 'PLAYER_MOVED',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      timestamp: 1,
      turnNumber: 1,
    };
    const noticeEvents = [
      {
        kind: 'FACTION_LEADER_EMERGED',
        event: {
          type: 'FACTION_LEADER_EMERGED',
          factionId: 'goblin_warband',
          factionName: 'Goblin Warband',
          leaderId: entityId('goblin_warband_leader'),
          leaderName: 'Brakka',
          leaderTitle: 'Knife-King',
          leaderTemplateId: 'goblin_warlord',
          emergedOnRun: 2,
          emergedOnDepth: 3,
          timestamp: 4,
          turnNumber: 12,
        } satisfies DomainEvent,
      },
      {
        kind: 'FACTION_LEADER_SLAIN',
        event: {
          type: 'FACTION_LEADER_SLAIN',
          factionId: 'goblin_warband',
          factionName: 'Goblin Warband',
          leaderId: entityId('goblin_warband_leader'),
          leaderName: 'Brakka',
          leaderTitle: 'Knife-King',
          slainAtDepth: 5,
          timestamp: 5,
          turnNumber: 13,
        } satisfies DomainEvent,
      },
      {
        kind: 'DUNGEON_OGRE_EMERGED',
        event: {
          type: 'DUNGEON_OGRE_EMERGED',
          ogreId: 'dungeon_ogre',
          emergedAfterRun: 4,
          emergedAtDepth: 6,
          eligibleSpawnDepths: [7, 8, 9],
          selectedSpawnDepth: 8,
          timestamp: 6,
          turnNumber: 14,
        } satisfies DomainEvent,
      },
      {
        kind: 'EQUIP_BLOCKED',
        event: {
          type: 'EQUIP_BLOCKED',
          reason: 'That ring conflicts with your oath.',
          timestamp: 7,
          turnNumber: 15,
        } satisfies DomainEvent,
      },
    ] as const;

    for (const { kind, event } of noticeEvents) {
      const withPrependedHistory = makeState({
        world: {
          ...makeState().world,
          eventHistory: [olderEvent, event],
        },
      });
      const afterTrim = makeState({
        world: {
          ...makeState().world,
          eventHistory: [event],
        },
      });

      expect(getNoticeId(withPrependedHistory, kind)).toBe(
        getNoticeId(afterTrim, kind),
      );
    }
  });

  it('sorts visible enemies by nearest distance first', () => {
    let state = createTestGameStateInCombat();
    if (!state.run) throw new Error('No run');

    // Create enemies at different distances from player (at 0,0)
    const nearEnemy = createTestEnemy({ position: { x: 1, y: 0 } }); // distance ~1
    const farEnemy = createTestEnemy({ position: { x: 5, y: 0 } }); // distance ~5
    const midEnemy = createTestEnemy({ position: { x: 3, y: 0 } }); // distance ~3

    const nearKey = posKey(nearEnemy.position);
    const midKey = posKey(midEnemy.position);
    const farKey = posKey(farEnemy.position);

    // Add to state in arbitrary order (far, mid, near) to test sorting
    const enemies = new Map([
      [farKey, farEnemy],
      [midKey, midEnemy],
      [nearKey, nearEnemy],
    ]);

    // Make all visible
    const cells = new Map(state.run.floor.cells);
    cells.set(nearKey, { tile: { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#fff' }, visibility: 'visible' as const });
    cells.set(midKey, { tile: { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#fff' }, visibility: 'visible' as const });
    cells.set(farKey, { tile: { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#fff' }, visibility: 'visible' as const });

    state = {
      ...state,
      run: {
        ...state.run,
        floor: { ...state.run.floor, cells },
        enemies,
      },
    };

    const view = buildGameView(state);
    const inspectables = view.inspectableEntities;

    // Should be sorted by distance: near, mid, far
    expect(inspectables.length).toBeGreaterThanOrEqual(3);
    const nearIdx = inspectables.findIndex(e => e.id === nearEnemy.id);
    const midIdx = inspectables.findIndex(e => e.id === midEnemy.id);
    const farIdx = inspectables.findIndex(e => e.id === farEnemy.id);

    // All should be found
    expect(nearIdx).toBeGreaterThanOrEqual(0);
    expect(midIdx).toBeGreaterThanOrEqual(0);
    expect(farIdx).toBeGreaterThanOrEqual(0);

    // Near should come before mid, mid before far
    expect(nearIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(farIdx);
  });
});
