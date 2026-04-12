import type { RNG } from '@dungeon/contracts';
import { clamp } from './math.js';

/** Roll result with variance applied */
export function rollDamage(base: number, variance: number, rng: RNG): number {
  const multiplier = 1 + rng.float(-variance, variance);
  return Math.max(1, Math.round(base * multiplier));
}

/** Calculate hit chance: base + accuracy - evasion, clamped */
export function calculateHitChance(
  baseHitChance: number,
  accuracy: number,
  evasion: number,
  minChance: number,
  maxChance: number,
): number {
  const raw = baseHitChance + accuracy - evasion;
  return clamp(raw, minChance, maxChance);
}

/** Defense mitigation: damage * (1 - defense / (defense + divisor)) */
export function applyDefense(damage: number, defense: number, divisor: number): number {
  const reduction = defense / (defense + divisor);
  return Math.max(1, Math.round(damage * (1 - reduction)));
}
