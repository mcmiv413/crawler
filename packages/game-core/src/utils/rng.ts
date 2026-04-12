import type { RNG } from '@dungeon/contracts';

/**
 * Alea-based seeded RNG — instance-local state, no global mutations.
 * Eliminates race conditions from rot-js's global RNG singleton on concurrent requests.
 */
export class SeededRNG implements RNG {
  private s0: number;
  private s1: number;
  private s2: number;
  private c: number;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.c = 1;

    // Mash initialization
    const mash = this.createMash();
    this.s0 = mash(' ');
    this.s1 = mash(' ');
    this.s2 = mash(' ');

    const seedStr = seed.toString();
    this.s0 -= mash(seedStr);
    if (this.s0 < 0) this.s0 += 1;

    this.s1 -= mash(seedStr);
    if (this.s1 < 0) this.s1 += 1;

    this.s2 -= mash(seedStr);
    if (this.s2 < 0) this.s2 += 1;
  }

  /** Get the seed this RNG was initialized with */
  getSeed(): number {
    return this.seed;
  }

  /** Random float [0, 1) */
  next(): number {
    const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10;
    this.s0 = this.s1;
    this.s1 = this.s2;
    return (this.s2 = t - (this.c = Math.floor(t)));
  }

  /** Random integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Random float in [min, max) */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Returns true with given probability (0-100) */
  chance(percent: number): boolean {
    return this.next() * 100 < percent;
  }

  /** Pick a random element from an array */
  pick<T>(arr: readonly T[]): T {
    const idx = this.int(0, arr.length - 1);
    return arr[idx]!;
  }

  /** Shuffle an array (returns new array) */
  shuffle<T>(arr: readonly T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  private createMash(): (str: string) => number {
    let n = 0xefc8249d;

    return (str: string) => {
      for (let i = 0; i < str.length; i++) {
        n += str.charCodeAt(i);
        let h = 0.02654799353567265 * n;
        n = (h >>> 0) as unknown as number;
        h -= n;
        h *= n;
        n = (h >>> 0) as unknown as number;
        h -= n;
        n += h * 0x6d2b79f5;
      }
      return ((n >>> 0) as unknown as number) * 2.3283064365386963e-10;
    };
  }
}
