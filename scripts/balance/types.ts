/**
 * types.ts — Shared type definitions and interfaces
 */

import type { GameCommand } from '@dungeon/contracts';
import type { AvailableAction } from '@dungeon/presenter';

// ---------------------------------------------------------------------------
// Direction Navigation
// ---------------------------------------------------------------------------

export type Dir8 = { dx: number; dy: number; dir: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW' };
export const DIRS8: Dir8[] = [
  { dx: 0, dy: -1, dir: 'N' },
  { dx: 0, dy: 1, dir: 'S' },
  { dx: 1, dy: 0, dir: 'E' },
  { dx: -1, dy: 0, dir: 'W' },
  { dx: 1, dy: -1, dir: 'NE' },
  { dx: -1, dy: -1, dir: 'NW' },
  { dx: 1, dy: 1, dir: 'SE' },
  { dx: -1, dy: 1, dir: 'SW' },
];

// ---------------------------------------------------------------------------
// Equipment & Session Results
// ---------------------------------------------------------------------------

export interface EquipmentSnapshot {
  weaponName: string | null;
  weaponDamage: number;
  weaponType: string | null;
  totalDefenseFromGear: number;
  armorSlotsFilled: number;   // out of 6
  peakArmorSlotsFilled: number;  // max slots filled at any point during session
  equippedRarities: Record<string, number>;  // rarity → count, e.g., { common: 2, uncommon: 1 }
}

export interface RunResult {
  runIndex: number;
  strategy: 'random' | 'greedy' | 'smart' | 'lm';
  seed: number;
  // Campaign context (0 for independent sessions)
  campaignIndex: number;
  // Session structure
  dungeonEntries: number;
  sessionEndReason: 'death' | 'retreat' | 'victory' | 'permadeath' | 'max_turns' | 'max_entries';
  maxFloorReached: number;
  floorOfDeath: number | null;
  // Cumulative metrics across all entries in this session
  totalFloorsDescended: number;   // count of staircase descents (not RunMetrics.floorsCleared which is victory-only)
  totalTurnsElapsed: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalEnemiesKilled: number;
  totalItemsUsed: number;
  totalGoldEarned: number;
  totalGoldSpent: number;
  // World state at session end (reflects persistent progression)
  worldDeepestFloor: number;
  worldNemesisCount: number;
  worldFactionCount: number;
  // Weapon mastery and nemesis encounter
  weaponMastery: { blade: number; bludgeon: number; axe: number; ranged: number };
  nemesisEncountered: boolean;
  lmFallbackCount: number;
  // Equipment snapshot at session end
  equipmentSnapshot: EquipmentSnapshot;
  // Economy
  goldAtEnd: number;
  shopPurchaseCount: number;
  shopPurchaseGold: number;
  restCost: number;
  // Mastery
  weaponSwitchCount: number;
  masteryAbilitiesUnlocked: number;
  primaryWeaponType: string | null;
  // Consumables
  potionsUsed: number;
  potionsUnusedAtEnd: number;
  bombsUsed: number;
  elixirsUsed: number;
  // Progression
  playerLevelAtEnd: number;
  totalExperience: number;
  // Death consequences
  permadeaths: number;
  maxOverkillDamage: number;
  nemesisPromotions: number;
  deathStashRecoveries: number;
  deathStashLosses: number;
  // Phase 2: Status effects and elemental damage tracking
  statusesInflicted: Record<string, number>;  // e.g., { burn: 12, slow: 5, weaken: 3 }
  fireDamageReceived: number;
  physicalDamageReceived: number;
  // Phase 2: World state tracking
  townCorruptionFinal: number;
  townFearFinal: number;
  townProsperityFinal: number;
  factionsAtHighPower: number;  // count of factions with power >= 50
  // Phase 2: Ability and action tracking
  weaponSwapsIssued: number;  // count of SWAP_WEAPONS commands
  abilityUsageBreakdown: Record<string, number>;  // e.g., { power_strike: 8, second_wind: 2 }
  npcInteractionCount: number;  // count of TALK commands issued
  // Phase 3: Enchantment tracking
  enchantmentsApplied: number;  // total count of enchantments successfully applied during town phase
  enchantmentGoldSpent: number;  // total gold spent on enchanting
  enchantmentBreakdown: Record<string, number>;  // e.g., { hp_regen: 2, defense_boost: 1, thorns: 1 }
  // Phase 4: Dungeon loot tracking (source of gear)
  chestsOpened: number;  // count of chest interactions
  itemsFromChests: number;  // count of items looted from chests
  itemsFromEnemyDrops: number;  // count of items looted from enemy kills
  totalItemsAcquired: number;  // total items from all sources (chests + enemy drops + shop)
  itemsDropped: number;  // items dropped due to inventory full
  itemsSoldCount: number;  // count of items sold in town
  itemsSoldGold: number;  // total gold earned from selling
}

// ---------------------------------------------------------------------------
// Aggregated Stats
// ---------------------------------------------------------------------------

export interface AggregateStats {
  strategy: string;
  totalRuns: number;
  survivalRateByFloor: Record<number, number>;
  avgDungeonEntries: number;
  avgMaxFloorReached: number;
  stdDevMaxFloor: number;  // Standard deviation of max floor reached
  avgFloorsDescended: number;
  avgTurnsElapsed: number;
  avgDamageDealt: number;
  stdDevDamageDealt: number;  // Standard deviation of damage dealt
  avgDamageTaken: number;
  stdDevDamageTaken: number;  // Standard deviation of damage taken
  avgDmgRatio: number;
  avgEnemiesKilled: number;
  avgGoldEarned: number;
  avgGoldSpent: number;
  deathRate: number;
  retreatRate: number;
  victoryRate: number;
  winRateTarget: number;  // Target victory rate (80% for balance)
  maxTurnsRate: number;
  maxEntriesRate: number;
  deathsByFloor: Record<number, number>;
  mostCommonDeathFloor: number | null;
  weaponTypeUsage: { blade: number; bludgeon: number; axe: number; ranged: number };
  nemesisEncounterRate: number;
  avgWorldDeepestFloor: number;
  avgWorldNemesisCount: number;
  // Equipment impact
  avgTotalDefenseFromGear: number;
  avgWeaponDamage: number;
  avgArmorSlotsFilled: number;
  // Economy health
  avgGoldAtEnd: number;
  avgShopPurchases: number;
  avgRestCost: number;
  // Mastery effectiveness
  avgMasteryAbilities: number;
  avgWeaponSwitches: number;
  weaponCommitmentRate: number;  // % with switches <= 1
  // Consumable usage
  avgPotionsUsed: number;
  avgPotionsWasted: number;
  avgBombsUsed: number;
  // Progression
  avgPlayerLevel: number;
  avgExperience: number;
  // Death consequences
  totalPermadeaths: number;
  maxOverkillDamage: number;
  totalNemesisPromotions: number;
  totalDeathStashRecoveries: number;
  totalDeathStashLosses: number;
  // Phase 2: Status and damage type tracking
  avgStatusesInflicted: Record<string, number>;  // average per-run
  avgFireDamageReceived: number;
  avgPhysicalDamageReceived: number;
  // Phase 2: World state
  avgTownCorruptionFinal: number;
  avgTownFearFinal: number;
  avgTownProsperityFinal: number;
  avgFactionsAtHighPower: number;
  // Phase 2: Actions
  avgWeaponSwapsIssued: number;
  avgAbilityUsageBreakdown: Record<string, number>;
  avgNpcInteractionCount: number;
  // Phase 3: Enchantments
  avgEnchantmentsApplied: number;
  avgEnchantmentGoldSpent: number;
  avgEnchantmentBreakdown: Record<string, number>;
  // Phase 4: Dungeon loot sources
  avgChestsOpened: number;
  avgItemsFromChests: number;
  avgItemsFromEnemyDrops: number;
  avgTotalItemsAcquired: number;
  lootToShopRatio: number;  // items from dungeon vs shop purchases
  avgItemsDropped: number;
  avgItemsSoldCount: number;
  avgItemsSoldGold: number;
}

export interface BalanceReport {
  generatedAt: string;
  startedAt?: string;
  scriptVersion: string;
  runsPerStrategy: number;
  campaignLength: number;
  strategies: string[];
  results: RunResult[];
  aggregates: AggregateStats[];
  metadata: {
    nodeVersion: string;
    maxEntriesPerSession: number;
    maxTotalTurnsGlobal: number;
    isProgress?: boolean;
    balanceSnapshot: {
      baseMaxHealth: number;
      baseAttack: number;
      baseDefense: number;
      floorHealthMult: number;
      floorAttackMult: number;
      defenseDivisor: number;
    };
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface CliArgs {
  runs: number;
  strategies: Array<'random' | 'greedy' | 'smart' | 'lm'>;
  seed: number;
  out: string;
  campaign: number; // 0 = independent sessions; N = campaign length
}

// ---------------------------------------------------------------------------
// BFS Navigation
// ---------------------------------------------------------------------------

export interface BfsNode { x: number; y: number; firstDir: 'N' | 'S' | 'E' | 'W' }
