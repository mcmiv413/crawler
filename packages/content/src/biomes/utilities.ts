import type { BiomeDefinition } from './stone-crypt.js';
import { stoneCrypt } from './stone-crypt.js';
import { BIOME_DEFINITIONS } from './index.js';

export function BIOME_BY_FLOOR(depth: number, rng?: { next(): number }): BiomeDefinition {
  const candidates = Array.from(BIOME_DEFINITIONS.values()).filter(
    b => depth >= b.floorRange.min && depth <= b.floorRange.max,
  );
  if (candidates.length === 0) return stoneCrypt;
  const idx = rng !== undefined ? Math.floor(rng.next() * candidates.length) : 0;
  return candidates[Math.min(idx, candidates.length - 1)]!;
}
