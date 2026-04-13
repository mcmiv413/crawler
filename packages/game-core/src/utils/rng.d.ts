import type { RNG } from '@dungeon/contracts';
/**
 * Alea-based seeded RNG — instance-local state, no global mutations.
 * Eliminates race conditions from rot-js's global RNG singleton on concurrent requests.
 */
export declare class SeededRNG implements RNG {
    private s0;
    private s1;
    private s2;
    private c;
    private seed;
    constructor(seed: number);
    /** Get the seed this RNG was initialized with */
    getSeed(): number;
    /** Random float [0, 1) */
    next(): number;
    /** Random integer in [min, max] inclusive */
    int(min: number, max: number): number;
    /** Random float in [min, max) */
    float(min: number, max: number): number;
    /** Returns true with given probability (0-100) */
    chance(percent: number): boolean;
    /** Pick a random element from an array */
    pick<T>(arr: readonly T[]): T;
    /** Shuffle an array (returns new array) */
    shuffle<T>(arr: readonly T[]): T[];
    private createMash;
}
//# sourceMappingURL=rng.d.ts.map