/**
 * Shared test factories for game-core unit tests.
 * Import via relative path — not exported from the package barrel.
 */
import type { Player, EnemyInstance, NemesisRecord, GameState, GamePhase, WorldState, PlayerStats, PlayerAbility, RunState, WeaponMastery, Position, EntityId, AnyItemTemplate } from '@dungeon/contracts';
import { entityId, EMPTY_WEAPON_MASTERY, EMPTY_RUN_METRICS } from '@dungeon/contracts';
import { BASE_PLAYER_STATS, INITIAL_FACTIONS, ITEM_BY_ID } from '@dungeon/content';
import { ALL_ABILITY_DEFINITIONS } from './abilities/definitions/index.js';

export const BASE_TEST_STATS: PlayerStats = { ...BASE_PLAYER_STATS };

let testEnemyCounter = 1;

export function resetTestEnemyCounter(): void {
  testEnemyCounter = 1;
}

export function createTestPlayer(overrides?: Partial<Player>): Player {
  return {
    id: entityId('p1'),
    name: 'Hero',
    level: 1,
    experience: 0,
    stats: { ...BASE_PLAYER_STATS },
    baseStats: { ...BASE_PLAYER_STATS },
    position: { x: 0, y: 0 },
    equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
    inventory: [],
    statuses: [],
    abilities: [],
    gold: 50,
    floor: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalRuns: 0,
    deathStash: null,
    ...overrides,
  };
}

export function createTestEnemy(overrides?: Partial<EnemyInstance>): EnemyInstance {
  const id = entityId(`e${testEnemyCounter}`);
  testEnemyCounter++;
  return {
    id,
    templateId: 'goblin_archer',
    name: 'Goblin Archer',
    archetype: 'ranged',
    tier: 2,
    stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 120 },
    equipment: {
      weapon: {
        damageMultiplier: 1.0,
        damageType: 'physical',
        weaponRange: 1,
      },
    },
    affinities: {},
    spawn: {
      floorRange: [1, 3],
      weight: 1,
    },
    lootTableId: 'goblin',
    experienceValue: 20,
    description: 'A sneaky goblin scout.',
    ascii: 'g',
    biomes: [],
    factions: [],
    position: { x: 1, y: 1 },
    statuses: [],
    isAlerted: true,
    lastKnownPlayerPos: null,
    ambientState: 'roaming',
    ambientStateAge: 0,
    ...overrides,
  };
}

export function createTestNemesis(overrides?: Partial<NemesisRecord>): NemesisRecord {
  return {
    id: entityId('n1'),
    name: 'Vorreth',
    title: 'the Unbroken',
    sourceTemplateId: 'goblin_skirmisher',
    rank: 1,
    tier: 2,
    stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 120 },
    traits: [],
    weaknesses: [],
    killEventId: null,
    encounterCount: 0,
    isActive: true,
    killCount: 1,
    floorOfAscension: 2,
    biomeOfAscension: 'crypt',
    killedByWeaponType: null,
    ...overrides,
  };
}

export function createTestRunState(overrides?: {
  weaponMastery?: Partial<WeaponMastery>;
  enemies?: ReadonlyMap<string, EnemyInstance>;
}): RunState {
  const floorCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'visible' as const };
  const cells = new Map([
    ['0,0', floorCell],
    ['1,0', floorCell],
    ['0,1', floorCell],
    ['1,1', floorCell],
  ]);
  const enemies = overrides?.enemies ?? new Map();
  const speedAccumulators: Record<string, number> = {};
  for (const enemy of enemies.values()) {
    speedAccumulators[enemy.id] = 0;
  }

  return {
    runId: entityId('run1'),
    floor: { width: 10, height: 10, depth: 1, biomeId: 'crypt', cells, entrance: { x: 0, y: 0 }, exit: { x: 9, y: 9 }, seed: 42 },
    enemies,
    objects: new Map(),
    turnCount: 0,
    isActive: true,
    runMetrics: EMPTY_RUN_METRICS,
    floorHistory: [],
    floorCache: new Map(),
    weaponMastery: { ...EMPTY_WEAPON_MASTERY, ...overrides?.weaponMastery },
    speedAccumulators,
  };
}

export function createTestGameStateInCombat(options?: {
  equippedWeaponId?: string;
  weaponMastery?: Partial<WeaponMastery>;
  enemyAt?: { x: number; y: number };
}): GameState {
  const weaponId = options?.equippedWeaponId ?? 'rusty_sword';
  const enemyPos = options?.enemyAt ?? { x: 1, y: 0 };
  const enemy = createTestEnemy({ position: enemyPos });
  const enemyKey = `${enemyPos.x},${enemyPos.y}`;

  // Build item registry from content
  const itemRegistry = { items: new Map(ITEM_BY_ID) as unknown as ReadonlyMap<EntityId, AnyItemTemplate> };

  const run = createTestRunState({
    enemies: new Map([[enemyKey, enemy]]),
    weaponMastery: options?.weaponMastery,
  });

  const base = createTestGameState({
    player: {
      position: { x: 0, y: 0 },
      equipment: { weapon: entityId(weaponId), secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
    },
    phase: 'dungeon',
  });

  return {
    ...base,
    run,
    itemRegistry,
  };
}

export function createTestGameState(overrides?: {
  player?: Partial<Player> & { abilities?: readonly PlayerAbility[] };
  world?: Partial<WorldState>;
  phase?: GamePhase;
}): GameState {
  return {
    gameId: entityId('g1'),
    phase: overrides?.phase ?? 'town',
    player: createTestPlayer(overrides?.player),
    run: null,
    world: {
      town: { prosperity: 50, fear: 20, corruption: 10, rumors: [], lastRunSummary: null },
      npcs: [],
      shop: { items: [], buybackMultiplier: 0.4 },
      eventHistory: [],
      totalRuns: 0,
      deepestFloor: 0,
      nemeses: [],
      factions: [...INITIAL_FACTIONS],
      unlockedBlueprints: [],
      highestRarityFound: 'common' as const,
      ...overrides?.world,
    },
    itemRegistry: { items: new Map() },
    seed: 42,
    turnNumber: 10,
    version: 1,
    activeQuests: [],
  };
}

/** Weapon ID lookup by weapon type */
const WEAPON_BY_TYPE: Record<string, string> = {
  blade: 'rusty_sword',
  bludgeon: 'iron_mace',
  axe: 'hand_axe',
  ranged: 'short_bow',
};

/** Ability definition lookup by ID */
const ABILITY_DEFINITIONS = new Map(ALL_ABILITY_DEFINITIONS.map(def => [def.id, def]));

/**
 * Create a GameState ready for ability testing.
 * Equips the correct weapon type for the ability and grants the ability with 0 cooldown.
 */
export function createTestGameStateWithAbility(abilityId: string, options?: {
  enemyPosition?: Position;
  enemyHealth?: number;
  additionalEnemies?: Array<{ id: string; position: Position; health?: number }>;
}): GameState {
  const def = ABILITY_DEFINITIONS.get(abilityId);
  const weaponTypeRequirement = def?.requirements.find(req => req.kind === 'weapon_type');
  const weaponType = (weaponTypeRequirement && 'weaponType' in weaponTypeRequirement && typeof (weaponTypeRequirement as Record<string, string>).weaponType === 'string' ? (weaponTypeRequirement as Record<string, string>).weaponType : undefined) ?? 'blade';
  const weaponId = WEAPON_BY_TYPE[weaponType] ?? 'rusty_sword';
  const enemyPos = options?.enemyPosition ?? { x: 1, y: 0 };

  const enemy = createTestEnemy({
    position: enemyPos,
    ...(options?.enemyHealth !== undefined
      ? { stats: { maxHealth: options.enemyHealth, health: options.enemyHealth, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 120 } }
      : {}),
  });

  const enemies = new Map<string, EnemyInstance>([[`${enemyPos.x},${enemyPos.y}`, enemy]]);
  if (options?.additionalEnemies) {
    for (const extra of options.additionalEnemies) {
      const extraEnemy = createTestEnemy({
        id: entityId(extra.id),
        name: `Enemy ${extra.id}`,
        position: extra.position,
        ...(extra.health !== undefined
          ? { stats: { maxHealth: extra.health, health: extra.health, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 120 } }
          : {}),
      });
      enemies.set(`${extra.position.x},${extra.position.y}`, extraEnemy);
    }
  }

  const base = createTestGameStateInCombat({ equippedWeaponId: weaponId, enemyAt: enemyPos });

  return {
    ...base,
    run: {
      ...base.run!,
      enemies,
    },
    player: {
      ...base.player,
      abilities: [{ id: abilityId, cooldownRemaining: 0 }],
    },
  };
}

// ============================================================================
// Command Builders (Replace `as any` Casts)
// ============================================================================

/** Create a properly typed USE_ABILITY command */
export function createUseAbilityCommand(abilityId: string, targetId?: EntityId): { type: 'USE_ABILITY'; abilityId: string; targetId: string | undefined } {
  return {
    type: 'USE_ABILITY' as const,
    abilityId,
    targetId: targetId as unknown as string,
  };
}

/** Create a properly typed MOVE command */
export function createMoveCommand(x: number, y: number): { type: 'MOVE'; position: { x: number; y: number } } {
  return {
    type: 'MOVE' as const,
    position: { x, y },
  };
}

/** Create a properly typed ATTACK command */
export function createAttackCommand(targetId: EntityId): { type: 'ATTACK'; targetId: string } {
  return {
    type: 'ATTACK' as const,
    targetId: targetId as unknown as string,
  };
}

/** Create a properly typed EQUIP command */
export function createEquipCommand(itemId: EntityId): { type: 'EQUIP'; itemId: string } {
  return {
    type: 'EQUIP' as const,
    itemId: itemId as unknown as string,
  };
}

/** Create a properly typed USE_ITEM command */
export function createUseItemCommand(itemId: EntityId): { type: 'USE_ITEM'; itemId: string } {
  return {
    type: 'USE_ITEM' as const,
    itemId: itemId as unknown as string,
  };
}

/** Create a properly typed WAIT command */
export function createWaitCommand(): { type: 'WAIT' } {
  return {
    type: 'WAIT' as const,
  };
}

/** Create a properly typed RETREAT command */
export function createRetreatCommand(): { type: 'RETREAT' } {
  return {
    type: 'RETREAT' as const,
  };
}

/** Create a properly typed MOVE command (with direction) */
export function createMoveCommandWithDirection(direction: 'N' | 'S' | 'E' | 'W'): { type: 'MOVE'; direction: 'N' | 'S' | 'E' | 'W' } {
  return {
    type: 'MOVE' as const,
    direction,
  };
}

/** Create a properly typed INTERACT command */
export function createInteractCommand(x: number, y: number): { type: 'INTERACT'; targetPosition: { x: number; y: number } } {
  return {
    type: 'INTERACT' as const,
    targetPosition: { x, y },
  };
}

/** Create a properly typed UNEQUIP command */
export function createUnequipCommand(itemId: EntityId): { type: 'UNEQUIP'; itemId: string } {
  return {
    type: 'UNEQUIP' as const,
    itemId: itemId as unknown as string,
  };
}

/** Create a properly typed SWAP_WEAPONS command */
export function createSwapWeaponsCommand(): { type: 'SWAP_WEAPONS' } {
  return {
    type: 'SWAP_WEAPONS' as const,
  };
}

/** Create a properly typed ENCHANT_ARMOR command */
export function createEnchantArmorCommand(
  equipSlot: 'weapon' | 'chest' | 'head' | 'gloves' | 'boots' | 'ring1' | 'ring2',
  enchantmentId: string,
): { type: 'ENCHANT_ARMOR'; equipSlot: 'weapon' | 'chest' | 'head' | 'gloves' | 'boots' | 'ring1' | 'ring2'; enchantmentId: string } {
  return {
    type: 'ENCHANT_ARMOR' as const,
    equipSlot,
    enchantmentId,
  };
}

/** Create a properly typed ASCEND command */
export function createAscendCommand(): { type: 'ASCEND' } {
  return {
    type: 'ASCEND' as const,
  };
}

