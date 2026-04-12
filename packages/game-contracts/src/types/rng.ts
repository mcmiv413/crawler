/**
 * Deterministic random number generator interface.
 * All implementations must be seeded and produce identical sequences for the same seed.
 */
export interface RNG {
  /** Get a random float in [0, 1) */
  next(): number;

  /** Get a random integer in [min, max] inclusive */
  int(min: number, max: number): number;

  /** Get a random float in [min, max) */
  float(min: number, max: number): number;

  /** Return true with given probability (0-100) */
  chance(percent: number): boolean;

  /** Pick a random element from an array */
  pick<T>(arr: readonly T[]): T;

  /** Shuffle an array and return a new array */
  shuffle<T>(arr: readonly T[]): T[];

  /** Get the seed this RNG was initialized with */
  getSeed(): number;
}
