import { entityId, EMPTY_WEAPON_MASTERY, EMPTY_RUN_METRICS } from '@dungeon/contracts';
import { BASE_PLAYER_STATS, INITIAL_FACTIONS, ITEM_BY_ID, ABILITY_DEFINITIONS } from '@dungeon/content';
export const BASE_TEST_STATS = { ...BASE_PLAYER_STATS };
export function createTestPlayer(overrides) {
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
export function createTestEnemy(overrides) {
    return {
        id: entityId('e1'),
        templateId: 'goblin_skirmisher',
        name: 'Goblin Skirmisher',
        archetype: 'fast_skirmisher',
        tier: 2,
        stats: { maxHealth: 30, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 120 },
        damageType: 'physical',
        resistances: {},
        abilities: [],
        lootTableId: 'goblin',
        experienceValue: 20,
        position: { x: 1, y: 1 },
        statuses: [],
        isAlerted: true,
        lastKnownPlayerPos: null,
        ...overrides,
    };
}
export function createTestNemesis(overrides) {
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
export function createTestRunState(overrides) {
    const floorCell = { tile: { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'visible' };
    const cells = new Map([
        ['0,0', floorCell],
        ['1,0', floorCell],
        ['0,1', floorCell],
        ['1,1', floorCell],
    ]);
    return {
        runId: entityId('run1'),
        floor: { width: 10, height: 10, depth: 1, biomeId: 'crypt', cells, entrance: { x: 0, y: 0 }, exit: { x: 9, y: 9 }, seed: 42 },
        enemies: overrides?.enemies ?? new Map(),
        items: new Map(),
        turnCount: 0,
        isActive: true,
        runMetrics: EMPTY_RUN_METRICS,
        floorHistory: [],
        floorCache: new Map(),
        weaponMastery: { ...EMPTY_WEAPON_MASTERY, ...overrides?.weaponMastery },
    };
}
export function createTestGameStateInCombat(options) {
    const weaponId = options?.equippedWeaponId ?? 'rusty_sword';
    const enemyPos = options?.enemyAt ?? { x: 1, y: 0 };
    const enemy = createTestEnemy({ position: enemyPos });
    const enemyKey = `${enemyPos.x},${enemyPos.y}`;
    // Build item registry from content
    const itemRegistry = { items: new Map(ITEM_BY_ID) };
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
export function createTestGameState(overrides) {
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
            highestRarityFound: 'common',
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
const WEAPON_BY_TYPE = {
    blade: 'rusty_sword',
    bludgeon: 'iron_mace',
    axe: 'hand_axe',
    ranged: 'short_bow',
};
/**
 * Create a GameState ready for ability testing.
 * Equips the correct weapon type for the ability and grants the ability with 0 cooldown.
 */
export function createTestGameStateWithAbility(abilityId, options) {
    const def = ABILITY_DEFINITIONS[abilityId];
    const weaponType = def?.requiresWeaponType ?? 'blade';
    const weaponId = WEAPON_BY_TYPE[weaponType] ?? 'rusty_sword';
    const enemyPos = options?.enemyPosition ?? { x: 1, y: 0 };
    const enemy = createTestEnemy({
        position: enemyPos,
        ...(options?.enemyHealth !== undefined
            ? { stats: { maxHealth: options.enemyHealth, health: options.enemyHealth, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 120 } }
            : {}),
    });
    const enemies = new Map([[`${enemyPos.x},${enemyPos.y}`, enemy]]);
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
            ...base.run,
            enemies,
        },
        player: {
            ...base.player,
            abilities: [{ id: abilityId, cooldownRemaining: 0 }],
        },
    };
}
//# sourceMappingURL=test-utils.js.map