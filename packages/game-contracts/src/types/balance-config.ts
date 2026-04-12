/**
 * Runtime-injectable balance configuration.
 * Allows overriding combat and floor scaling values during gameplay and testing.
 */
export interface BalanceConfig {
  combat: {
    baseHitChance: number;
    minHitChance: number;
    maxHitChance: number;
    critChance: number;
    critMultiplier: number;
    damageVariance: number;
    defenseDivisor: number;
    minDamage: number;
  };
  floorScaling: {
    healthMultiplier: number;
    attackMultiplier: number;
    defenseMultiplier: number;
    experienceMultiplier: number;
  };
}
