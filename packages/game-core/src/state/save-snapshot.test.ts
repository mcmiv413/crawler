import { describe, expect, it } from 'vitest';
import type {
  AnyItemTemplate,
  ConsumableTemplate,
  EnemyInstance,
  EntityId,
  GameCommand,
  GameState,
  ObjectInstance,
  StoredFloor,
  WeaponTemplate,
  ArmorTemplate,
} from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { GameEngine } from '../engine/game-engine.js';
import {
  createTestGameState,
  createTestGameStateInCombat,
  createTestGameStateWithAbility,
  createTestEnemy,
  createTestRunState,
  createWaitCommand,
} from '../test-utils.js';
import {
  exportSaveSnapshot,
  loadSaveSnapshot,
  migrateSaveSnapshot,
  SAVE_SNAPSHOT_SCHEMA_VERSION,
  SaveSnapshotLoadError,
  validateSaveSnapshot,
} from './save-snapshot.js';

const TEST_WEAPON: WeaponTemplate = {
  itemId: 'rusty_sword',
  name: 'Snapshot Test Sword',
  description: 'A local fixture weapon for save snapshot tests.',
  itemClass: 'weapon',
  rarity: 'common',
  value: 1,
  stackable: false,
  maxStack: 1,
  weapon: {
    damage: 4,
    damageType: 'physical',
    accuracy: 90,
    speed: 1,
    slot: 'weapon',
    weaponRange: 1,
    weaponType: 'blade',
  },
};

const TEST_RING: ArmorTemplate = {
  itemId: 'fire_ring',
  name: 'Snapshot Test Fire Ring',
  description: 'A local fixture ring for save snapshot tests.',
  itemClass: 'armor',
  rarity: 'common',
  value: 1,
  stackable: false,
  maxStack: 1,
  armor: {
    defense: 0,
    evasionPenalty: 0,
    slot: 'ring',
    enchantmentSlots: 0,
    enchantments: [],
  },
};

const TEST_CHEST_ARMOR: ArmorTemplate = {
  itemId: 'plate_armor',
  name: 'Snapshot Test Plate',
  description: 'A local fixture chest armor for save snapshot tests.',
  itemClass: 'armor',
  rarity: 'common',
  value: 1,
  stackable: false,
  maxStack: 1,
  armor: {
    defense: 2,
    evasionPenalty: 0,
    slot: 'chest',
    enchantmentSlots: 0,
    enchantments: [],
  },
};

const TEST_BOOTS_ARMOR: ArmorTemplate = {
  itemId: 'leather_boots',
  name: 'Snapshot Test Boots',
  description: 'A local fixture boots armor for save snapshot tests.',
  itemClass: 'armor',
  rarity: 'common',
  value: 1,
  stackable: false,
  maxStack: 1,
  armor: {
    defense: 1,
    evasionPenalty: 0,
    slot: 'boots',
    enchantmentSlots: 0,
    enchantments: [],
  },
};

const TEST_POTION: ConsumableTemplate = {
  itemId: 'health_potion',
  name: 'Snapshot Test Potion',
  description: 'A local fixture potion for save snapshot tests.',
  itemClass: 'consumable',
  rarity: 'common',
  value: 1,
  stackable: false,
  maxStack: 1,
  consumable: {
    effect: 'heal',
    magnitude: 25,
  },
};

// Specific narrow types for invalid test fixtures — no unknown involved.
type InvalidPositionEnemy = Omit<EnemyInstance, 'position'> & { position: { x: string; y: number } };
type InvalidPositionObject = Omit<ObjectInstance, 'position'> & { position: { x: string; y: number } };
type InvalidExhaustedObject = Omit<ObjectInstance, 'isExhausted'> & { isExhausted: string };
type InvalidPositionAndExhaustedObject = Omit<ObjectInstance, 'position' | 'isExhausted'> & {
  position: { x: string; y: number };
  isExhausted: string;
};

type MutableSnapshot = Record<string, unknown> & {
  player?: {
    inventory?: EntityId[];
    equipment?: Record<string, EntityId | null>;
    learnedRingSpellIds?: string[];
    knownRingSchools?: string[];
  };
  world?: Record<string, unknown>;
  run?: Record<string, unknown> | null;
  floor?: { cells?: Record<string, unknown> } | null;
  enemies?: Record<string, EnemyInstance | string | InvalidPositionEnemy>;
  objects?: Record<string, ObjectInstance | InvalidPositionObject | InvalidExhaustedObject | InvalidPositionAndExhaustedObject>;
  itemRegistry?: { items?: Record<string, AnyItemTemplate> };
  weaponMastery?: Record<string, unknown>;
};

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function roundTrip(state: GameState): GameState {
  return loadSaveSnapshot(jsonClone(exportSaveSnapshot(state)));
}

function expectSnapshotRoundTrip(state: GameState): GameState {
  const snapshot = exportSaveSnapshot(state);
  const restored = loadSaveSnapshot(jsonClone(snapshot));

  expect(exportSaveSnapshot(restored)).toEqual(snapshot);
  return restored;
}

function expectCommandEquivalent(state: GameState, command: GameCommand): void {
  const engine = new GameEngine();
  const restored = roundTrip(state);

  const originalResult = engine.submitCommand(state, command);
  const restoredResult = engine.submitCommand(restored, command);

  expect(restoredResult.events).toEqual(originalResult.events);
  expect(exportSaveSnapshot(restoredResult.state)).toEqual(exportSaveSnapshot(originalResult.state));
}

function withRegistryItem(
  state: GameState,
  itemId: EntityId,
  template: AnyItemTemplate,
): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      inventory: [...state.player.inventory, itemId],
    },
    itemRegistry: {
      items: new Map([...state.itemRegistry.items, [itemId, template]]),
    },
  };
}

function withRegisteredEquipment(
  state: GameState,
): GameState {
  const weaponEntityId = entityId('snapshot_weapon_entity');
  const ringEntityId = entityId('snapshot_ring_entity');
  return {
    ...state,
    player: {
      ...state.player,
      level: 6,
      experience: 550,
      gold: 777,
      equipment: {
        ...state.player.equipment,
        weapon: weaponEntityId,
        ring1: ringEntityId,
      },
      inventory: [...state.player.inventory, entityId('snapshot_potion_entity')],
    },
    itemRegistry: {
      items: new Map([
        ...state.itemRegistry.items,
        [weaponEntityId, TEST_WEAPON],
        [ringEntityId, TEST_RING],
        [entityId('snapshot_potion_entity'), TEST_POTION],
      ]),
    },
    weaponMastery: {
      ...state.weaponMastery,
      blade: 17,
    },
  };
}

function firstEnemy(state: GameState): EnemyInstance {
  const enemy = [...(state.run?.enemies.values() ?? [])][0];
  if (enemy === undefined) {
    throw new Error('Expected test state to contain an enemy');
  }
  return enemy;
}

function mutableSnapshot(state: GameState): MutableSnapshot {
  return jsonClone(exportSaveSnapshot(state)) as unknown as MutableSnapshot;
}

type EntryOrder = 'forward' | 'reverse';

function orderedEntries<K, V>(
  entries: readonly (readonly [K, V])[],
  order: EntryOrder,
): [K, V][] {
  const mutableEntries = entries.map(([key, value]) => [key, value] as [K, V]);
  return order === 'forward' ? mutableEntries : mutableEntries.reverse();
}

function createSnapshotObject(
  id: EntityId,
  position: { readonly x: number; readonly y: number },
  isExhausted: boolean,
): ObjectInstance {
  return {
    id,
    templateId: 'healing_fountain',
    position,
    isExhausted,
  };
}

function createStoredFloorFromRun(
  run: NonNullable<GameState['run']>,
  playerPosition: GameState['player']['position'],
  depth: number,
): StoredFloor {
  return {
    floor: {
      ...run.floor,
      depth,
    },
    enemies: run.enemies,
    objects: run.objects,
    playerPosition,
    originalEnemyCount: run.enemies.size,
    lastSimulatedTurn: run.turnCount,
  };
}

function createRepresentativeSaveState(order: EntryOrder = 'forward'): GameState {
  const base = createTestGameStateInCombat();
  const weaponEntityId = entityId('snapshot_weapon_entity');
  const ringEntityId = entityId('snapshot_ring_entity');
  const potionEntityId = entityId('snapshot_potion_entity');

  const enemyA = createTestEnemy({
    id: entityId('snapshot_enemy_a'),
    position: { x: 1, y: 0 },
  });
  const enemyB = createTestEnemy({
    id: entityId('snapshot_enemy_b'),
    position: { x: 0, y: 1 },
  });
  const enemyEntries = [
    ['1,0', enemyA],
    ['0,1', enemyB],
  ] as const;
  const objectEntries = [
    ['1,1', createSnapshotObject(entityId('snapshot_fountain_a'), { x: 1, y: 1 }, true)],
    ['0,1', createSnapshotObject(entityId('snapshot_fountain_b'), { x: 0, y: 1 }, false)],
  ] as const;
  const speedEntries = [
    [enemyB.id, 4],
    [enemyA.id, 2],
  ] as const;
  const itemEntries: readonly (readonly [EntityId, AnyItemTemplate])[] = [
    [potionEntityId, TEST_POTION],
    [ringEntityId, TEST_RING],
    [weaponEntityId, TEST_WEAPON],
  ];

  const run = {
    ...base.run!,
    enemies: new Map(orderedEntries(enemyEntries, order)),
    objects: new Map(orderedEntries(objectEntries, order)),
    turnCount: 9,
    speedAccumulators: Object.fromEntries(orderedEntries(speedEntries, order)),
  };
  const player = {
    ...base.player,
    level: 5,
    experience: 450,
    gold: 321,
    floor: 1,
    position: { x: 0, y: 0 },
    equipment: {
      ...base.player.equipment,
      weapon: weaponEntityId,
      ring1: ringEntityId,
    },
    inventory: [potionEntityId],
    knownRingSchools: ['fire'],
    learnedRingSpellIds: ['ember'],
    ringMastery: { fire: { xp: 80 } },
    mana: 5,
    maxMana: 10,
  };
  const cachedFloorA = createStoredFloorFromRun(run, player.position, 2);
  const cachedFloorB = createStoredFloorFromRun(run, player.position, 7);

  return {
    ...base,
    player,
    run,
    world: {
      ...base.world,
      totalRuns: 2,
      deepestFloor: 3,
    },
    itemRegistry: {
      items: new Map(orderedEntries(itemEntries, order)),
    },
    turnNumber: 88,
    persistedFloorCache: new Map(orderedEntries([
      [7, cachedFloorB],
      [2, cachedFloorA],
    ] as const, order)),
    weaponMastery: {
      blade: 17,
      bludgeon: 3,
      axe: 4,
      ranged: 5,
      dagger: 6,
    },
  };
}

function expectRecordKeysSorted(record: Readonly<Record<string, unknown>>): void {
  const keys = Object.keys(record);
  expect(keys).toEqual([...keys].sort((left, right) => left.localeCompare(right)));
}

function validationErrorText(snapshot: unknown): string {
  const validation = validateSaveSnapshot(snapshot);
  expect(validation.isValid).toBe(false);
  return validation.errors.map(error => `${error.field}: ${error.message}`).join('\n');
}

function expectInvalidSnapshot(snapshot: unknown, fieldPattern: RegExp): void {
  const validation = validateSaveSnapshot(snapshot);
  expect(validation.isValid).toBe(false);
  expect(validation.errors.map(error => error.field).join('\n')).toMatch(fieldPattern);
  expect(() => loadSaveSnapshot(snapshot)).toThrow(fieldPattern);
}

function validationErrors(snapshot: unknown) {
  const validation = validateSaveSnapshot(snapshot);
  expect(validation.isValid).toBe(false);
  return validation.errors;
}

function validationFields(snapshot: unknown): string[] {
  return validateSaveSnapshot(snapshot).errors.map(error => error.field);
}

function expectValidationField(snapshot: unknown, expectedField: string) {
  const errors = validationErrors(snapshot);
  const error = errors.find(candidate => candidate.field === expectedField);
  expect(error, errors.map(candidate => `${candidate.field}: ${candidate.message}`).join('\n')).toBeDefined();
  return error!;
}

function addFloorCell(snapshot: MutableSnapshot, key: string): void {
  if (snapshot.floor === undefined || snapshot.floor === null) {
    throw new Error('Expected snapshot floor to exist');
  }
  snapshot.floor.cells = {
    ...snapshot.floor.cells,
    [key]: snapshot.floor.cells?.[key] ?? snapshot.floor.cells?.['0,0'] ?? {},
  };
}

function removeFloorCell(snapshot: MutableSnapshot, key: string): void {
  if (snapshot.floor === undefined || snapshot.floor === null || snapshot.floor.cells === undefined) {
    throw new Error('Expected snapshot floor cells to exist');
  }
  delete snapshot.floor.cells[key];
}

describe('SaveSnapshot validation path consistency', () => {
  it('uses root weaponMastery paths', () => {
    const missingBlade = mutableSnapshot(createTestGameStateInCombat());
    delete missingBlade.weaponMastery!.blade;
    expectValidationField(missingBlade, 'weaponMastery.blade');
    expect(validationFields(missingBlade)).not.toContain('player.weaponMastery.blade');

    const invalidBludgeon = mutableSnapshot(createTestGameStateInCombat());
    invalidBludgeon.weaponMastery!.bludgeon = 'bad';
    expectValidationField(invalidBludgeon, 'weaponMastery.bludgeon');
    expect(validationFields(invalidBludgeon)).not.toContain('player.weaponMastery.bludgeon');

    const negativeAxe = mutableSnapshot(createTestGameStateInCombat());
    negativeAxe.weaponMastery!.axe = -1;
    expectValidationField(negativeAxe, 'weaponMastery.axe');
    expect(validationFields(negativeAxe)).not.toContain('player.weaponMastery.axe');
  });

  it('uses player equipment paths for missing and incompatible equipment', () => {
    const missingWeapon = mutableSnapshot(createTestGameState());
    missingWeapon.player!.equipment = {
      ...missingWeapon.player!.equipment,
      weapon: entityId('missing_weapon_entity'),
    };
    expectValidationField(missingWeapon, 'player.equipment.weapon');

    const armorInWeaponSlot = mutableSnapshot(createTestGameState());
    armorInWeaponSlot.itemRegistry = {
      items: { snapshot_bad_weapon_armor: TEST_CHEST_ARMOR },
    };
    armorInWeaponSlot.player!.equipment = {
      ...armorInWeaponSlot.player!.equipment,
      weapon: entityId('snapshot_bad_weapon_armor'),
    };
    expectValidationField(armorInWeaponSlot, 'player.equipment.weapon');
    expect(validationFields(armorInWeaponSlot)).not.toContain('equipment.weapon');

    const weaponInChestSlot = mutableSnapshot(createTestGameState());
    weaponInChestSlot.itemRegistry = {
      items: { snapshot_bad_chest_weapon: TEST_WEAPON },
    };
    weaponInChestSlot.player!.equipment = {
      ...weaponInChestSlot.player!.equipment,
      chest: entityId('snapshot_bad_chest_weapon'),
    };
    expectValidationField(weaponInChestSlot, 'player.equipment.chest');
    expect(validationFields(weaponInChestSlot)).not.toContain('equipment.chest');
  });

  it('uses bracket paths for object fields', () => {
    const invalidTemplateId = mutableSnapshot(createTestGameStateInCombat());
    invalidTemplateId.objects = {
      '1,1': {
        ...createSnapshotObject(entityId('invalid_template_object'), { x: 1, y: 1 }, false),
        templateId: 'missing_object_template',
      },
    };
    expectValidationField(invalidTemplateId, 'objects[1,1].templateId');
    expect(validationFields(invalidTemplateId)).not.toContain('objects.1,1.templateId');

    const invalidPosXObject: InvalidPositionObject = {
      id: entityId('invalid_position_object'),
      templateId: 'healing_fountain',
      position: { x: 'bad', y: 1 },
      isExhausted: false,
    };
    const invalidPositionX = mutableSnapshot(createTestGameStateInCombat());
    invalidPositionX.objects = { '1,1': invalidPosXObject };
    expectValidationField(invalidPositionX, 'objects[1,1].position.x');

    const invalidIsExhaustedObject: InvalidExhaustedObject = {
      ...createSnapshotObject(entityId('invalid_exhausted_object'), { x: 1, y: 1 }, false),
      isExhausted: 'bad',
    };
    const invalidIsExhausted = mutableSnapshot(createTestGameStateInCombat());
    invalidIsExhausted.objects = { '1,1': invalidIsExhaustedObject };
    expectValidationField(invalidIsExhausted, 'objects[1,1].isExhausted');
  });

  it('uses bracket paths for enemy fields', () => {
    const baseEnemy = Object.values(mutableSnapshot(createTestGameStateInCombat()).enemies ?? {})[0]! as EnemyInstance;

    const invalidTemplateId = mutableSnapshot(createTestGameStateInCombat());
    invalidTemplateId.enemies = {
      '4,5': {
        ...baseEnemy,
        templateId: 'missing_enemy_template',
        position: { x: 4, y: 5 },
      },
    };
    expectValidationField(invalidTemplateId, 'enemies[4,5].templateId');
    expect(validationFields(invalidTemplateId)).not.toContain('enemies.4,5.templateId');

    const nonObjectEnemy = mutableSnapshot(createTestGameStateInCombat());
    nonObjectEnemy.enemies = {
      '4,5': 'bad',
    };
    expectValidationField(nonObjectEnemy, 'enemies[4,5]');
    expect(validationFields(nonObjectEnemy)).not.toContain('enemies.4,5');

    const invalidPositionEnemy: InvalidPositionEnemy = {
      ...baseEnemy,
      position: { x: 'bad', y: 5 },
    };
    const invalidPosition = mutableSnapshot(createTestGameStateInCombat());
    invalidPosition.enemies = {
      '4,5': invalidPositionEnemy,
    };
    expectValidationField(invalidPosition, 'enemies[4,5].position');
    expect(validationFields(invalidPosition)).not.toContain('enemies.4,5.position');
  });

  it('uses inventory index paths and includes the bad entity id in the message', () => {
    const snapshot = mutableSnapshot(createTestGameStateInCombat());
    const badEntityId = entityId('missing_inventory_entity');
    snapshot.player!.inventory = [badEntityId];

    const error = expectValidationField(snapshot, 'player.inventory[0]');
    expect(error.message).toContain(badEntityId);
    expect(validationFields(snapshot)).not.toContain(`player.inventory.${badEntityId}`);
  });

  it('uses knownRingSchools index paths and includes the invalid school in the message', () => {
    const snapshot = mutableSnapshot(createTestGameStateInCombat());
    snapshot.player!.knownRingSchools = ['missing_school'];

    const error = expectValidationField(snapshot, 'player.knownRingSchools[0]');
    expect(error.message).toContain('missing_school');
    expect(validationFields(snapshot)).not.toContain('player.knownRingSchools.missing_school');
  });

  it('validates object key-position consistency', () => {
    const mismatched = mutableSnapshot(createTestGameStateInCombat());
    mismatched.objects = {
      '1,1': createSnapshotObject(entityId('mismatched_object'), { x: 20, y: 20 }, false),
    };
    const error = expectValidationField(mismatched, 'objects[1,1].position');
    expect(error.message).toContain('20,20');

    const matched = mutableSnapshot(createTestGameStateInCombat());
    addFloorCell(matched, '1,1');
    matched.objects = {
      '1,1': createSnapshotObject(entityId('matched_object'), { x: 1, y: 1 }, false),
    };
    const validation = validateSaveSnapshot(matched);
    expect(validation.errors.map(error => error.message)).not.toContain('object map key must match object position 1,1');
  });

  it('validates object floor membership', () => {
    const missingFloorCell = mutableSnapshot(createTestGameStateInCombat());
    removeFloorCell(missingFloorCell, '1,1');
    missingFloorCell.objects = {
      '1,1': createSnapshotObject(entityId('missing_floor_cell_object'), { x: 1, y: 1 }, false),
    };
    const error = expectValidationField(missingFloorCell, 'objects[1,1].position');
    expect(error.message).toBe('object position must reference an existing floor cell');

    const existingFloorCell = mutableSnapshot(createTestGameStateInCombat());
    addFloorCell(existingFloorCell, '1,1');
    existingFloorCell.objects = {
      '1,1': createSnapshotObject(entityId('existing_floor_cell_object'), { x: 1, y: 1 }, false),
    };
    const validation = validateSaveSnapshot(existingFloorCell);
    expect(validation.errors).not.toContainEqual({
      field: 'objects[1,1].position',
      message: 'object position must reference an existing floor cell',
    });
  });
});

describe('SaveSnapshot round trips', () => {
  it('Test Group 1: restores a new game into a playable equivalent state', () => {
    const engine = new GameEngine();
    const original = engine.createNewGame(1001);

    const restored = expectSnapshotRoundTrip(original);

    expect(restored.phase).toBe(original.phase);
    expect(restored.player.level).toBe(original.player.level);
    const entered = engine.submitCommand(restored, { type: 'TOWN_ACTION', action: 'enter_dungeon' });
    expect(entered.state.phase).toBe('dungeon');
    expect(entered.state.run).not.toBeNull();
    expect(entered.events.length).toBeGreaterThan(0);
  });

  it('Test Group 2: preserves character progression, equipment, gold, and mastery', () => {
    const progressed = withRegisteredEquipment(createTestGameState());

    const restored = expectSnapshotRoundTrip(progressed);

    expect(restored.player.level).toBe(6);
    expect(restored.player.experience).toBe(550);
    expect(restored.player.gold).toBe(777);
    expect(restored.player.equipment.weapon).toBe(entityId('snapshot_weapon_entity'));
    expect(restored.player.equipment.ring1).toBe(entityId('snapshot_ring_entity'));
    expect(restored.itemRegistry.items.get(entityId('snapshot_weapon_entity'))?.itemId).toBe('rusty_sword');
    expect(restored.weaponMastery.blade).toBe(17);
  });

  it('Test Group 3: preserves learned spells, mastery, mana, and spell playability', () => {
    const spellState = createTestGameStateWithAbility('ember');
    const progressedSpellState: GameState = {
      ...spellState,
      player: {
        ...spellState.player,
        mana: 7,
        maxMana: 12,
        knownRingSchools: ['fire'],
        learnedRingSpellIds: ['ember'],
        ringMastery: { fire: { xp: 125 } },
      },
    };

    const restored = expectSnapshotRoundTrip(progressedSpellState);

    expect(restored.player.learnedRingSpellIds).toContain('ember');
    expect(restored.player.ringMastery.fire?.xp).toBe(125);
    expect(restored.player.mana).toBe(7);
    expectCommandEquivalent(restored, {
      type: 'USE_ABILITY',
      abilityId: 'ember',
      targetId: firstEnemy(restored).id,
    });
  });

  it('Test Group 4: preserves world progression and run history', () => {
    const base = createTestGameState();
    const progressedWorld: GameState = {
      ...base,
      player: {
        ...base.player,
        totalRuns: 4,
      },
      world: {
        ...base.world,
        totalRuns: 4,
        deepestFloor: 5,
        town: {
          ...base.world.town,
          corruption: 88,
          fear: 64,
        },
        factions: base.world.factions.map((faction, index) => index === 0
          ? {
              ...faction,
              power: 0,
              status: 'broken',
              leaderSlain: true,
              membersKilledByPlayer: faction.membersKilledByPlayer + 3,
            }
          : faction),
        dungeonOgre: {
          id: 'dungeon_ogre',
          status: 'emerged',
          emergedAfterRun: 4,
          emergedAtDepth: 5,
          eligibleSpawnDepths: [5],
          selectedSpawnDepth: 5,
        },
        eventHistory: [
          ...base.world.eventHistory,
          {
            type: 'RUN_ENDED',
            runId: entityId('snapshot_run_history'),
            reason: 'retreat',
            floorsCleared: 3,
            timestamp: base.turnNumber,
            turnNumber: base.turnNumber,
          },
        ],
      },
    };

    const restored = expectSnapshotRoundTrip(progressedWorld);

    expect(restored.world.town.corruption).toBe(88);
    expect(restored.world.totalRuns).toBe(4);
    expect(restored.world.deepestFloor).toBe(5);
    expect(restored.world.factions[0]?.status).toBe('broken');
    expect(restored.world.dungeonOgre.status).toBe('emerged');
    expect(restored.world.eventHistory).toHaveLength(progressedWorld.world.eventHistory.length);
  });

  it('Test Group 5: preserves partially completed dungeon state', () => {
    const combatState = createTestGameStateInCombat();
    const lootEntityId = entityId('snapshot_dungeon_loot');
    const looted = withRegistryItem(combatState, lootEntityId, TEST_POTION);
    const dungeonState: GameState = {
      ...looted,
      turnNumber: 42,
      player: {
        ...looted.player,
        position: { x: 0, y: 1 },
        totalKills: looted.player.totalKills + 1,
      },
      run: {
        ...looted.run!,
        turnCount: 9,
        enemies: new Map(),
        objects: new Map([
          ['1,1', {
            id: entityId('snapshot_spent_fountain'),
            templateId: 'healing_fountain',
            position: { x: 1, y: 1 },
            isExhausted: true,
          }],
        ]),
        speedAccumulators: {},
      },
    };

    const restored = expectSnapshotRoundTrip(dungeonState);

    expect(restored.player.position).toEqual({ x: 0, y: 1 });
    expect(restored.player.inventory).toContain(lootEntityId);
    expect(restored.run?.turnCount).toBe(9);
    expect(restored.run?.enemies.size).toBe(0);
    expect(restored.run?.objects.get('1,1')?.isExhausted).toBe(true);
    expectCommandEquivalent(restored, { type: 'MOVE', direction: 'E' });
  });

  it('Test Group 6: restored states behave identically for representative commands', () => {
    const movementState: GameState = {
      ...createTestGameState({ phase: 'dungeon' }),
      run: createTestRunState(),
      player: {
        ...createTestGameState().player,
        floor: 1,
        position: { x: 0, y: 0 },
      },
    };
    const combatState = createTestGameStateInCombat();
    const itemState = withRegistryItem(
      {
        ...combatState,
        player: {
          ...combatState.player,
          stats: { ...combatState.player.stats, health: 1 },
        },
      },
      entityId('snapshot_behavior_potion'),
      TEST_POTION,
    );
    const spellState = createTestGameStateWithAbility('ember');

    expectCommandEquivalent(movementState, { type: 'MOVE', direction: 'S' });
    expectCommandEquivalent(combatState, { type: 'ATTACK', targetId: firstEnemy(combatState).id });
    expectCommandEquivalent(itemState, { type: 'USE_ITEM', itemId: entityId('snapshot_behavior_potion') });
    expectCommandEquivalent(spellState, {
      type: 'USE_ABILITY',
      abilityId: 'ember',
      targetId: firstEnemy(spellState).id,
    });
    expectCommandEquivalent(combatState, createWaitCommand());
  });

  it('Test Group 7: exports equivalent states deterministically without mutation', () => {
    const state = withRegisteredEquipment(createTestGameStateInCombat());
    const inventoryBefore = [...state.player.inventory];
    const itemRegistrySizeBefore = state.itemRegistry.items.size;

    const first = exportSaveSnapshot(state);
    const second = exportSaveSnapshot(state);

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(state.player.inventory).toEqual(inventoryBefore);
    expect(state.itemRegistry.items.size).toBe(itemRegistrySizeBefore);
  });

  it('export-load-export stabilization', () => {
    const state = createRepresentativeSaveState();

    const snapshot1 = exportSaveSnapshot(state);
    const restored = loadSaveSnapshot(jsonClone(snapshot1));
    const snapshot2 = exportSaveSnapshot(restored);

    expect(snapshot2).toEqual(snapshot1);
  });

  it('normalizes hostile insertion order for registries, maps, speed accumulators, and cached floors', () => {
    const forwardSnapshot = exportSaveSnapshot(createRepresentativeSaveState('forward'));
    const reverseSnapshot = exportSaveSnapshot(createRepresentativeSaveState('reverse'));

    expect(reverseSnapshot).toEqual(forwardSnapshot);
    expectRecordKeysSorted(forwardSnapshot.itemRegistry.items);
    expectRecordKeysSorted(forwardSnapshot.enemies);
    expectRecordKeysSorted(forwardSnapshot.objects);
    expectRecordKeysSorted(forwardSnapshot.run!.speedAccumulators);
    expectRecordKeysSorted(forwardSnapshot.persistedFloorCache ?? {});
  });
});

describe('SaveSnapshot validation and migration', () => {
  it('Test Group 9: rejects unsupported schema versions and missing required roots', () => {
    const valid = mutableSnapshot(createTestGameStateInCombat());

    expectInvalidSnapshot({ ...valid, schemaVersion: SAVE_SNAPSHOT_SCHEMA_VERSION + 1 }, /schemaVersion/);

    const missingPlayer = jsonClone(valid);
    delete missingPlayer.player;
    expectInvalidSnapshot(missingPlayer, /player/);

    const missingWorld = jsonClone(valid);
    delete missingWorld.world;
    expectInvalidSnapshot(missingWorld, /world/);

    const missingRun = jsonClone(valid);
    delete missingRun.run;
    expectInvalidSnapshot(missingRun, /run/);
  });

  it('Test Group 9: rejects invalid references with field-specific errors', () => {
    const valid = mutableSnapshot(createTestGameStateInCombat());

    const invalidItemId = jsonClone(valid);
    invalidItemId.itemRegistry!.items = {
      missing_item_entity: { ...TEST_POTION, itemId: 'missing_item_template' },
    };
    invalidItemId.player!.inventory = [entityId('missing_item_entity')];
    expectInvalidSnapshot(invalidItemId, /itemRegistry\.items\.missing_item_entity\.itemId/);

    const invalidEquipment = jsonClone(valid);
    invalidEquipment.player!.equipment = {
      ...invalidEquipment.player!.equipment,
      weapon: entityId('not_in_registry'),
    };
    expectInvalidSnapshot(invalidEquipment, /player\.equipment\.weapon/);

    const invalidRegistryReference = jsonClone(valid);
    invalidRegistryReference.player!.inventory = [entityId('not_in_registry')];
    expectInvalidSnapshot(invalidRegistryReference, /player\.inventory/);

    const invalidEnemy = jsonClone(valid);
    const enemyKey = Object.keys(invalidEnemy.enemies ?? {})[0]!;
    invalidEnemy.enemies![enemyKey] = {
      ...(invalidEnemy.enemies![enemyKey] as EnemyInstance),
      templateId: 'missing_enemy_template',
    };
    expectInvalidSnapshot(invalidEnemy, /enemies\[.*\]\.templateId/);

    const corruptEntityRelationship = jsonClone(valid);
    const enemy = Object.values(corruptEntityRelationship.enemies ?? {})[0]!;
    corruptEntityRelationship.enemies = {
      '9,9': enemy,
    };
    expectInvalidSnapshot(corruptEntityRelationship, /enemies\[9,9\]\.position/);

    const invalidFloor = jsonClone(valid);
    invalidFloor.floor = { ...invalidFloor.floor, cells: {} };
    expectInvalidSnapshot(invalidFloor, /floor\.cells/);

    const unknownSpell = jsonClone(valid);
    unknownSpell.player!.learnedRingSpellIds = ['missing_spell'];
    expectInvalidSnapshot(unknownSpell, /player\.learnedRingSpellIds\.missing_spell/);

    const invalidWeaponMastery = jsonClone(valid);
    invalidWeaponMastery.weaponMastery = {
      blade: 'not-a-number',
      bludgeon: 0,
      ranged: 0,
      dagger: 0,
    };
    const masteryErrors = validationErrorText(invalidWeaponMastery);
    expect(masteryErrors).toMatch(/weaponMastery\.blade/);
    expect(masteryErrors).toMatch(/weaponMastery\.axe/);

    const invalidSpeedAccumulator = jsonClone(valid);
    invalidSpeedAccumulator.run!.speedAccumulators = {
      snapshot_enemy_b: 0,
      snapshot_enemy_a: 'fast',
    };
    expectInvalidSnapshot(invalidSpeedAccumulator, /run\.speedAccumulators\[snapshot_enemy_a\]/);

    const invalidObjectFields = jsonClone(valid);
    const invalidObjField: InvalidPositionAndExhaustedObject = {
      id: entityId('invalid_object'),
      templateId: 'healing_fountain',
      position: { x: 'bad', y: 1 },
      isExhausted: 'yes',
    };
    invalidObjectFields.objects = { '1,1': invalidObjField };
    const objectErrors = validationErrorText(invalidObjectFields);
    expect(objectErrors).toMatch(/objects\[1,1\]\.position\.x/);
    expect(objectErrors).toMatch(/objects\[1,1\]\.isExhausted/);
  });

  it('rejects incompatible equipment slot item types before loading', () => {
    const cases: Array<{
      readonly slot: 'weapon' | 'secondaryWeapon' | 'chest' | 'head' | 'gloves' | 'boots' | 'ring1' | 'ring2';
      readonly entityId: EntityId;
      readonly template: AnyItemTemplate;
      readonly errorPattern: RegExp;
    }> = [
      {
        slot: 'weapon',
        entityId: entityId('snapshot_bad_weapon_potion'),
        template: TEST_POTION,
        errorPattern: /player\.equipment\.weapon: item "snapshot_bad_weapon_potion" is not a valid weapon \(got consumable\)/,
      },
      {
        slot: 'weapon',
        entityId: entityId('snapshot_bad_weapon_armor'),
        template: TEST_CHEST_ARMOR,
        errorPattern: /player\.equipment\.weapon: item "snapshot_bad_weapon_armor" is not a valid weapon \(got armor:chest\)/,
      },
      {
        slot: 'ring1',
        entityId: entityId('snapshot_bad_ring_weapon'),
        template: TEST_WEAPON,
        errorPattern: /player\.equipment\.ring1: item "snapshot_bad_ring_weapon" is not valid for ring1 slot \(got weapon\)/,
      },
      {
        slot: 'chest',
        entityId: entityId('snapshot_bad_chest_weapon'),
        template: TEST_WEAPON,
        errorPattern: /player\.equipment\.chest: item "snapshot_bad_chest_weapon" is not valid for chest slot \(got weapon\)/,
      },
      {
        slot: 'weapon',
        entityId: entityId('snapshot_bad_weapon_ring'),
        template: TEST_RING,
        errorPattern: /player\.equipment\.weapon: item "snapshot_bad_weapon_ring" is not a valid weapon \(got armor:ring\)/,
      },
      {
        slot: 'boots',
        entityId: entityId('snapshot_bad_boots_chest'),
        template: TEST_CHEST_ARMOR,
        errorPattern: /player\.equipment\.boots: item "snapshot_bad_boots_chest" is not valid for boots slot \(got armor:chest\)/,
      },
      {
        slot: 'chest',
        entityId: entityId('snapshot_bad_chest_boots'),
        template: TEST_BOOTS_ARMOR,
        errorPattern: /player\.equipment\.chest: item "snapshot_bad_chest_boots" is not valid for chest slot \(got armor:boots\)/,
      },
    ];

    for (const { slot, entityId: equippedEntityId, template, errorPattern } of cases) {
      const snapshot = mutableSnapshot(createTestGameState());
      snapshot.itemRegistry = { items: { [equippedEntityId]: template } };
      snapshot.player!.equipment = {
        ...snapshot.player!.equipment,
        [slot]: equippedEntityId,
      };

      const validationText = validationErrorText(snapshot);
      expect(validationText).toMatch(errorPattern);
      expect(() => loadSaveSnapshot(snapshot)).toThrow(errorPattern);
    }
  });

  it('rejects invalid snapshots before restore without returning partial state', () => {
    const snapshot = mutableSnapshot(createRepresentativeSaveState());
    snapshot.floor = null;
    snapshot.enemies = {
      '9,9': {
        ...(Object.values(snapshot.enemies ?? {})[0] as EnemyInstance),
        templateId: 'missing_enemy_template',
        position: { x: 9, y: 9 },
      },
    };
    snapshot.itemRegistry = {
      items: {
        corrupt_item_entity: {
          ...TEST_POTION,
          itemId: 'missing_item_template',
        },
      },
    };

    let restored: GameState | undefined;
    try {
      restored = loadSaveSnapshot(snapshot);
      throw new Error('Expected loadSaveSnapshot to reject the invalid snapshot');
    } catch (error) {
      expect(error).toBeInstanceOf(SaveSnapshotLoadError);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/floor/);
      expect(message).toMatch(/enemies\[9,9\]\.templateId/);
      expect(message).toMatch(/itemRegistry\.items\.corrupt_item_entity\.itemId/);
    }

    expect(restored).toBeUndefined();
  });

  it('Test Group 10: exposes migration entry points for version 1 and validates future versions before migration', () => {
    const snapshot = exportSaveSnapshot(createTestGameStateInCombat());

    expect(snapshot.schemaVersion).toBe(1);
    expect(migrateSaveSnapshot(snapshot)).toEqual(snapshot);

    const futureSnapshot = { ...snapshot, schemaVersion: 999 };
    const validation = validateSaveSnapshot(futureSnapshot);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.map(error => error.field)).toContain('schemaVersion');
    expect(() => loadSaveSnapshot(futureSnapshot)).toThrow(/schemaVersion/i);
  });
});
