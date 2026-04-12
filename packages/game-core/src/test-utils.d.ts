/**
 * Shared test factories for game-core unit tests.
 * Import via relative path — not exported from the package barrel.
 */
import type { Player, EnemyInstance, NemesisRecord, GameState, GamePhase, WorldState, PlayerStats, PlayerAbility, RunState, WeaponMastery, Position } from '@dungeon/contracts';
export declare const BASE_TEST_STATS: PlayerStats;
export declare function createTestPlayer(overrides?: Partial<Player>): Player;
export declare function createTestEnemy(overrides?: Partial<EnemyInstance>): EnemyInstance;
export declare function createTestNemesis(overrides?: Partial<NemesisRecord>): NemesisRecord;
export declare function createTestRunState(overrides?: {
    weaponMastery?: Partial<WeaponMastery>;
    enemies?: ReadonlyMap<string, EnemyInstance>;
}): RunState;
export declare function createTestGameStateInCombat(options?: {
    equippedWeaponId?: string;
    weaponMastery?: Partial<WeaponMastery>;
    enemyAt?: {
        x: number;
        y: number;
    };
}): GameState;
export declare function createTestGameState(overrides?: {
    player?: Partial<Player> & {
        abilities?: readonly PlayerAbility[];
    };
    world?: Partial<WorldState>;
    phase?: GamePhase;
}): GameState;
/**
 * Create a GameState ready for ability testing.
 * Equips the correct weapon type for the ability and grants the ability with 0 cooldown.
 */
export declare function createTestGameStateWithAbility(abilityId: string, options?: {
    enemyPosition?: Position;
    enemyHealth?: number;
    additionalEnemies?: Array<{
        id: string;
        position: Position;
        health?: number;
    }>;
}): GameState;
//# sourceMappingURL=test-utils.d.ts.map