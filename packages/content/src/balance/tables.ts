/** Balance tables — authoritative tuning constants for the game */

/** Base player stats at level 1 (50% health reduction for harder difficulty) */
export const BASE_PLAYER_STATS = {
  maxHealth: 36,
  health: 36,
  attack: 4,
  defense: 4,
  accuracy: 6,
  evasion: 8,
  speed: 100,
} as const;

/** Per-level stat gains */
export const LEVEL_UP_GAINS = {
  maxHealth: 10,
  attack: 1,
  defense: 2,
  accuracy: 1,
  evasion: 1,
  speed: 0,
} as const;

/** Experience required per level (index = level) */
export const XP_TABLE: readonly number[] = [
  0, 0, 60, 150, 300, 650, 1000, 1500, 2200, 3000, 4200,
];

/** Damage formula constants */
export const COMBAT = {
  /** Base hit chance before accuracy/evasion */
  baseHitChance: 65,
  /** Minimum hit chance (%) */
  minHitChance: 15,
  /** Maximum hit chance (%) */
  maxHitChance: 95,
  /** Critical hit chance (%) */
  critChance: 5,
  /** Critical hit damage multiplier */
  critMultiplier: 1.5,
  /** Minimum damage after all mitigation */
  minDamage: 1,
  /** Defense mitigation formula: reduction = defense / (defense + constant) */
  defenseDivisor: 35,
} as const;

/** Damage band profiles: spread values for damage range calculation */
export const DAMAGE_BAND_PROFILES = {
  player_unarmed: { spread: 0.15 },
  weapon_dagger: { spread: 0.18 },
  weapon_blade: { spread: 0.22 },
  weapon_axe: { spread: 0.30 },
  weapon_bludgeon: { spread: 0.34 },
  weapon_short_bow: { spread: 0.18 },
  weapon_war_bow: { spread: 0.20 },
  enemy_skirmisher: { spread: 0.18 },
  enemy_ambusher: { spread: 0.24 },
  enemy_bruiser: { spread: 0.28 },
  enemy_tank: { spread: 0.22 },
  enemy_caster: { spread: 0.16 },
} as const;

/**
 * Compute damage range from center value and profile spread.
 * min = round(center * (1 - spread))
 * max = round(center * (1 + spread))
 */
export function getDamageBand(
  center: number,
  profile: keyof typeof DAMAGE_BAND_PROFILES,
): { min: number; max: number } {
  const { spread } = DAMAGE_BAND_PROFILES[profile];
  return {
    min: Math.round(center * (1 - spread)),
    max: Math.round(center * (1 + spread)),
  };
}

/** Floor scaling: enemy stats multiply by this per floor depth */
export const FLOOR_SCALING = {
  healthMultiplier: 1.1,
  attackMultiplier: 1.08,
  defenseMultiplier: 1.05,
  experienceMultiplier: 1,
} as const;

/** Get floor scaling multipliers, reduced by 50% for floors 1-2 for easier early game */
export function getFloorScalingMultipliers(
  depth: number,
): Readonly<{ healthMultiplier: number; attackMultiplier: number; defenseMultiplier: number; experienceMultiplier: number }> {
  // Floors 1-2 are half difficulty; use sqrt of multipliers to represent half the exponent effect
  if (depth <= 2) {
    return {
      healthMultiplier: Math.sqrt(FLOOR_SCALING.healthMultiplier),
      attackMultiplier: Math.sqrt(FLOOR_SCALING.attackMultiplier),
      defenseMultiplier: Math.sqrt(FLOOR_SCALING.defenseMultiplier),
      experienceMultiplier: Math.sqrt(FLOOR_SCALING.experienceMultiplier),
    };
  }
  return FLOOR_SCALING;
}

/** Enemy respawn system configuration */
export const ENEMY_RESPAWN = {
  respawnIntervalTurns: 12,
  maxEnemiesOnFloor: 12,
  minSpawnDistFromPlayer: 6,
  respawnCountPerTick: 1,
} as const;

/** Map generation parameters */
export const MAP_GENERATION = {
  minWidth: 20,
  maxWidth: 32,
  minHeight: 15,
  maxHeight: 22,
  /** Max enemies per floor = baseDensity + perFloor * depth */
  enemyBaseDensity: 8,
  enemyPerFloor: 1,
  /** Max items per floor */
  itemBaseDensity: 2,
  itemPerFloor: 1,
  /** Retry attempts for invalid maps */
  maxRetries: 3,
} as const;

/** Town economy */
export const ECONOMY = {
  /** Heal cost at town healer */
  healCostPerHp: .5,
  /** Shop markup over base item value */
  shopMarkup: 1.5,
  /** Buyback price = value * buybackRate */
  buybackRate: 0.5,
  /** Starting gold (50% reduction for harder difficulty) */
  startingGold: 50,
  /** Gold dropped per enemy tier */
  goldPerTier: [0, 8, 16, 30, 60, 120],
} as const;

/** Object pool distribution: weights for spawning objects on floors */
export const OBJECT_POOL = {
  /** Category weights: trap, chest, healing, misc */
  categoryWeights: { trap: 40, chest: 35, healing: 15, misc: 10 } as const,
  /** Rarity distribution: common, uncommon, rare, epic, legendary */
  rarityWeights: { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 } as const,
  /** Minimum floor depth for rare+ rarity objects (floor < this uses common/uncommon only) */
  rareMinDepth: 3,
} as const;

/** Nemesis system promotion thresholds */
export const NEMESIS_PROMOTION = {
  maxActiveNemeses: 3,
  minFloorForPromotion: 1,
  promotionChanceByTier: { 1: 0.40, 2: 0.50, 3: 0.5, 4: 0.75, 5: 1.0 } as Record<number, number>,
  statMultiplierByRank: { 1: 2.5, 2: 4.0, 3: 6.0 } as Record<number, number>,
} as const;

export const DEATH_CONSEQUENCES = {
  goldLossPercent: 0.25,
  overkillPermadeathThreshold: 0.75,  // fraction of maxHP
} as const;

/** FOV radius */
export const VISION = {
  baseRadius: 8,
} as const;

/** Enchantment slots by armor rarity */
export const ENCHANTMENT_SLOTS_BY_RARITY: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 3,
};

/** Drop rarity weights by floor range: [common, uncommon, rare, epic] */
const DROP_WEIGHTS_BY_FLOOR_RANGE: readonly [number, number, number[], number][] = [
  [1, 2, [72, 24, 3, 1], 0],
  [3, 4, [52, 35, 12, 3], 0],
  [5, Infinity, [45, 35, 15, 5], 0],
];

/** Get drop weights [common, uncommon, rare, epic] for a given floor depth */
export function getDropWeights(depth: number): [number, number, number, number] {
  for (const [min, max, weights] of DROP_WEIGHTS_BY_FLOOR_RANGE) {
    if (depth >= min && depth <= max) {
      return weights as [number, number, number, number];
    }
  }
  return [50, 32, 13, 5];
}

/** Status effect default values */
export const STATUS_DEFAULTS = {
  poison: { damagePerTurn: 3, defaultDuration: 3 },
  burn: { damagePerTurn: 5, defaultDuration: 2 },
  slow: { speedMultiplier: 0.5, defaultDuration: 3 },
  stun: { defaultDuration: 1 },
  bleed: { damagePerTurn: 2, defaultDuration: 4 },
  weaken: { attackMultiplier: 0.7, defaultDuration: 3 },
  vulnerability: { defenseMultiplier: 0.5, defaultDuration: 3 },
  regeneration: { healPerTurn: 5, defaultDuration: 3 },
  strength: { defaultDuration: 10 },
} as const;

/** Rarity ranking system: determines which items can be purchased in shop */
const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

/**
 * Determine if an item rarity can be purchased in the shop.
 * - Common: always buyable
 * - Uncommon: buyable when player has found uncommon or higher
 * - Epic: buyable only when player has found legendary
 * - Rare, Legendary: never buyable
 */
export function isRarityBuyable(itemRarity: string, highestFound: string): boolean {
  if (itemRarity === 'common') return true;
  if (itemRarity === 'uncommon') return (RARITY_RANK[highestFound] ?? 0) >= RARITY_RANK['uncommon']!;
  if (itemRarity === 'rare') return (RARITY_RANK[highestFound] ?? 0) >= RARITY_RANK['rare']!;
  if (itemRarity === 'epic') return (RARITY_RANK[highestFound] ?? 0) >= RARITY_RANK['epic']!;
  return false;
}

// ─────────────────────────────────────────────────────────────────
// World Consequences: Run outcomes and event chain evaluation
// ─────────────────────────────────────────────────────────────────

/** Max stored events in world history log */
export const MAX_EVENT_HISTORY = 100;

/** How prosperity changes on run outcomes */
export const PROSPERITY_DELTAS = {
  /** Prosperity lost when player dies in the dungeon */
  onDeath: -3,
  /** Prosperity gained for retreating (scales: min 1, max 8 based on floors cleared) */
  onRetreatPerFloor: 2,   // multiplier; final = min(8, max(1, floorsCleared * this))
  /** Base prosperity gain on run victory */
  onVictoryBase: 10,
  /** Added to onVictoryBase per floor cleared */
  onVictoryPerFloor: 1,
} as const;

/** Kill streak prosperity bonuses during a run */
export const KILL_STREAK_BONUSES = {
  /** Minimum kills in a run to earn the first bonus */
  tier1Kills: 5,
  tier1Bonus: 2,
  tier2Kills: 10,
  tier2Bonus: 3,
} as const;

/** World state thresholds for NPC availability */
export const NPC_THRESHOLDS = {
  /** Shopkeeper stops appearing when prosperity falls below this */
  shopkeeperLeavesProsperity: 25,
  /** Shopkeeper returns when prosperity rises to or above this */
  shopkeeperReturnsProsperity: 40,
} as const;

/** Fear escalation: consecutive deaths that trigger a fear spike */
export const FEAR_ESCALATION = {
  /** Deaths within this many events to trigger fear spike */
  recentEventWindow: 20,
  deathsToTrigger: 3,
  /** Fear added per trigger (only if current fear < fearCap) */
  fearGain: 10,
  fearCap: 80,
} as const;

/** Nemesis slain world effect */
export const NEMESIS_SLAIN_WORLD_EFFECTS = {
  prosperityGain: 10,
  corruptionLoss: 5,
  corruptionPerActiveNemesis: 2,
} as const;

// ─────────────────────────────────────────────────────────────────
// World Modifiers: Dungeon generation adjustments by world state
// ─────────────────────────────────────────────────────────────────

/** Corruption thresholds that modify dungeon generation */
export const CORRUPTION_MODIFIERS = {
  /** Above this, prefer corrupted/poison enemy archetypes */
  preferCorruptEnemiesAbove: 50,
  /** Above this, enemies get a health multiplier */
  enemyHealthBonusAbove: 50,
  enemyHealthMultiplier: 1.1,
  /** Above this, some enemies are promoted one tier */
  tierUpgradeChanceAbove: 75,
  tierUpgradeChance: 0.1,
  /** Above this, boss encounters happen 1 floor earlier */
  earlyBossAbove: 90,
  earlyBossFloorAdjust: -1,
} as const;

/** Fear thresholds that modify enemy spawning */
export const FEAR_MODIFIERS = {
  /** Above this, prefer ambusher/fast_skirmisher archetypes */
  preferFastEnemiesAbove: 60,
} as const;

/** Max extra enemies that can be added by world modifiers */
export const WORLD_MODIFIER_CAPS = {
  maxExtraEnemies: 3,
} as const;

/** Create a default balance config from the current tables */
export function createDefaultBalanceConfig(): {
  readonly combat: {
    readonly baseHitChance: number;
    readonly minHitChance: number;
    readonly maxHitChance: number;
    readonly critChance: number;
    readonly critMultiplier: number;
    readonly defenseDivisor: number;
    readonly minDamage: number;
  };
  readonly floorScaling: {
    readonly healthMultiplier: number;
    readonly attackMultiplier: number;
    readonly defenseMultiplier: number;
    readonly experienceMultiplier: number;
  };
  readonly deathConsequences: {
    readonly overkillPermadeathThreshold: number;
  };
} {
  return {
    combat: {
      baseHitChance: COMBAT.baseHitChance,
      minHitChance: COMBAT.minHitChance,
      maxHitChance: COMBAT.maxHitChance,
      critChance: COMBAT.critChance,
      critMultiplier: COMBAT.critMultiplier,
      defenseDivisor: COMBAT.defenseDivisor,
      minDamage: COMBAT.minDamage,
    },
    floorScaling: {
      healthMultiplier: FLOOR_SCALING.healthMultiplier,
      attackMultiplier: FLOOR_SCALING.attackMultiplier,
      defenseMultiplier: FLOOR_SCALING.defenseMultiplier,
      experienceMultiplier: FLOOR_SCALING.experienceMultiplier,
    },
    deathConsequences: {
      overkillPermadeathThreshold: DEATH_CONSEQUENCES.overkillPermadeathThreshold,
    },
  };
}
