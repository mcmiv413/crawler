/**
 * reporting.ts — Aggregation and formatted output of balance test results
 */

import type { AggregateStats, RunResult } from './types.js';

// ---------------------------------------------------------------------------
// Statistical Helpers
// ---------------------------------------------------------------------------

export function calculateStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export function aggregate(runs: RunResult[]): AggregateStats {
  const empty: AggregateStats = {
    strategy: 'unknown', totalRuns: 0, survivalRateByFloor: {}, avgDungeonEntries: 0,
    avgMaxFloorReached: 0, stdDevMaxFloor: 0, avgFloorsDescended: 0, avgTurnsElapsed: 0, avgDamageDealt: 0, stdDevDamageDealt: 0, avgDamageTaken: 0, stdDevDamageTaken: 0,
    avgDmgRatio: 0, avgEnemiesKilled: 0, avgGoldEarned: 0, avgGoldSpent: 0,
    deathRate: 0, retreatRate: 0, victoryRate: 0, winRateTarget: 80, maxTurnsRate: 0, maxEntriesRate: 0,
    deathsByFloor: {}, mostCommonDeathFloor: null,
    weaponTypeUsage: { blade: 0, bludgeon: 0, axe: 0, ranged: 0 },
    nemesisEncounterRate: 0, avgWorldDeepestFloor: 0, avgWorldNemesisCount: 0,
    avgTotalDefenseFromGear: 0, avgWeaponDamage: 0, avgArmorSlotsFilled: 0,
    avgGoldAtEnd: 0, avgShopPurchases: 0, avgRestCost: 0,
    avgMasteryAbilities: 0, avgWeaponSwitches: 0, weaponCommitmentRate: 0,
    avgPotionsUsed: 0, avgPotionsWasted: 0, avgBombsUsed: 0,
    avgPlayerLevel: 0, avgExperience: 0,
    totalPermadeaths: 0, maxOverkillDamage: 0, totalNemesisPromotions: 0,
    totalDeathStashRecoveries: 0, totalDeathStashLosses: 0,
    avgStatusesInflicted: {}, avgFireDamageReceived: 0, avgPhysicalDamageReceived: 0,
    avgTownCorruptionFinal: 0, avgTownFearFinal: 0, avgTownProsperityFinal: 0, avgFactionsAtHighPower: 0,
    avgWeaponSwapsIssued: 0, avgAbilityUsageBreakdown: {}, avgNpcInteractionCount: 0,
    avgEnchantmentsApplied: 0, avgEnchantmentGoldSpent: 0, avgEnchantmentBreakdown: {},
    avgChestsOpened: 0, avgItemsFromChests: 0, avgItemsFromEnemyDrops: 0, avgTotalItemsAcquired: 0, lootToShopRatio: 0,
    avgItemsDropped: 0, avgItemsSoldCount: 0, avgItemsSoldGold: 0,
  };
  if (runs.length === 0) return empty;

  const n = runs.length;
  const strategy = runs[0]!.strategy;
  const avg = (fn: (r: RunResult) => number) => runs.reduce((s, r) => s + fn(r), 0) / n;

  const maxFloor = Math.max(...runs.map(r => r.maxFloorReached), 0);
  const survivalRateByFloor: Record<number, number> = {};
  for (let f = 1; f <= maxFloor; f++) {
    survivalRateByFloor[f] = Math.round(
      (runs.filter(r => r.maxFloorReached >= f).length / n) * 100,
    );
  }

  const deathsByFloor: Record<number, number> = {};
  for (const r of runs) {
    if (r.sessionEndReason === 'death' && r.floorOfDeath !== null) {
      deathsByFloor[r.floorOfDeath] = (deathsByFloor[r.floorOfDeath] ?? 0) + 1;
    }
  }

  let mostCommonDeathFloor: number | null = null;
  let maxDeaths = 0;
  for (const [floor, count] of Object.entries(deathsByFloor)) {
    if (count > maxDeaths) {
      maxDeaths = count;
      mostCommonDeathFloor = parseInt(floor, 10);
    }
  }

  const avgDealt = avg(r => r.totalDamageDealt);
  const avgTaken = avg(r => r.totalDamageTaken);

  // Calculate standard deviations for key metrics
  const maxFloorValues = runs.map(r => r.maxFloorReached);
  const damageDealtValues = runs.map(r => r.totalDamageDealt);
  const damageTakenValues = runs.map(r => r.totalDamageTaken);

  const stdDevMaxFloor = Math.round(calculateStdDev(maxFloorValues) * 10) / 10;
  const stdDevDamageDealt = Math.round(calculateStdDev(damageDealtValues));
  const stdDevDamageTaken = Math.round(calculateStdDev(damageTakenValues));

  return {
    strategy,
    totalRuns: n,
    survivalRateByFloor,
    avgDungeonEntries: Math.round(avg(r => r.dungeonEntries) * 10) / 10,
    avgMaxFloorReached: Math.round(avg(r => r.maxFloorReached) * 10) / 10,
    stdDevMaxFloor,
    avgFloorsDescended: Math.round(avg(r => r.totalFloorsDescended) * 10) / 10,
    avgTurnsElapsed: Math.round(avg(r => r.totalTurnsElapsed)),
    avgDamageDealt: Math.round(avgDealt),
    stdDevDamageDealt,
    avgDamageTaken: Math.round(avgTaken),
    stdDevDamageTaken,
    avgDmgRatio: avgTaken > 0 ? Math.round((avgDealt / avgTaken) * 100) / 100 : 0,
    avgEnemiesKilled: Math.round(avg(r => r.totalEnemiesKilled) * 10) / 10,
    avgGoldEarned: Math.round(avg(r => r.totalGoldEarned)),
    avgGoldSpent: Math.round(avg(r => r.totalGoldSpent)),
    deathRate: Math.round((runs.filter(r => r.sessionEndReason === 'death').length / n) * 100),
    retreatRate: Math.round((runs.filter(r => r.sessionEndReason === 'retreat').length / n) * 100),
    victoryRate: Math.round((runs.filter(r => r.sessionEndReason === 'victory').length / n) * 100),
    winRateTarget: 80,  // Target victory rate for balance assessment (80%)
    maxTurnsRate: Math.round((runs.filter(r => r.sessionEndReason === 'max_turns').length / n) * 100),
    maxEntriesRate: Math.round((runs.filter(r => r.sessionEndReason === 'max_entries').length / n) * 100),
    deathsByFloor,
    mostCommonDeathFloor,
    weaponTypeUsage: {
      blade: Math.round((runs.filter(r => r.weaponMastery.blade > 0).length / n) * 100),
      bludgeon: Math.round((runs.filter(r => r.weaponMastery.bludgeon > 0).length / n) * 100),
      axe: Math.round((runs.filter(r => r.weaponMastery.axe > 0).length / n) * 100),
      ranged: Math.round((runs.filter(r => r.weaponMastery.ranged > 0).length / n) * 100),
    },
    nemesisEncounterRate: Math.round((runs.filter(r => r.nemesisEncountered).length / n) * 100),
    avgWorldDeepestFloor: Math.round(avg(r => r.worldDeepestFloor) * 10) / 10,
    avgWorldNemesisCount: Math.round(avg(r => r.worldNemesisCount) * 100) / 100,
    // Equipment impact
    avgTotalDefenseFromGear: Math.round(avg(r => r.equipmentSnapshot.totalDefenseFromGear) * 10) / 10,
    avgWeaponDamage: Math.round(avg(r => r.equipmentSnapshot.weaponDamage) * 10) / 10,
    avgArmorSlotsFilled: Math.round(avg(r => r.equipmentSnapshot.armorSlotsFilled) * 10) / 10,
    // Economy health
    avgGoldAtEnd: Math.round(avg(r => r.goldAtEnd)),
    avgShopPurchases: Math.round(avg(r => r.shopPurchaseCount) * 10) / 10,
    avgRestCost: Math.round(avg(r => r.restCost)),
    // Mastery effectiveness
    avgMasteryAbilities: Math.round(avg(r => r.masteryAbilitiesUnlocked) * 10) / 10,
    avgWeaponSwitches: Math.round(avg(r => r.weaponSwitchCount) * 10) / 10,
    weaponCommitmentRate: Math.round((runs.filter(r => r.weaponSwitchCount <= 1).length / n) * 100),
    // Consumable usage
    avgPotionsUsed: Math.round(avg(r => r.potionsUsed) * 10) / 10,
    avgPotionsWasted: Math.round(avg(r => r.potionsUnusedAtEnd) * 10) / 10,
    avgBombsUsed: Math.round(avg(r => r.bombsUsed) * 10) / 10,
    // Progression
    avgPlayerLevel: Math.round(avg(r => r.playerLevelAtEnd) * 10) / 10,
    avgExperience: Math.round(avg(r => r.totalExperience)),
    // Death consequences
    totalPermadeaths: runs.reduce((s, r) => s + r.permadeaths, 0),
    maxOverkillDamage: Math.max(...runs.map(r => r.maxOverkillDamage), 0),
    totalNemesisPromotions: runs.reduce((s, r) => s + r.nemesisPromotions, 0),
    totalDeathStashRecoveries: runs.reduce((s, r) => s + r.deathStashRecoveries, 0),
    totalDeathStashLosses: runs.reduce((s, r) => s + r.deathStashLosses, 0),
    // Phase 2: Status and damage type tracking
    avgStatusesInflicted: (() => {
      const agg: Record<string, number> = {};
      for (const r of runs) {
        for (const [status, count] of Object.entries(r.statusesInflicted)) {
          agg[status] = (agg[status] ?? 0) + count / n;
        }
      }
      return agg;
    })(),
    avgFireDamageReceived: Math.round(avg(r => r.fireDamageReceived) * 10) / 10,
    avgPhysicalDamageReceived: Math.round(avg(r => r.physicalDamageReceived) * 10) / 10,
    // Phase 2: World state
    avgTownCorruptionFinal: Math.round(avg(r => r.townCorruptionFinal) * 10) / 10,
    avgTownFearFinal: Math.round(avg(r => r.townFearFinal) * 10) / 10,
    avgTownProsperityFinal: Math.round(avg(r => r.townProsperityFinal) * 10) / 10,
    avgFactionsAtHighPower: Math.round(avg(r => r.factionsAtHighPower) * 10) / 10,
    // Phase 2: Actions
    avgWeaponSwapsIssued: Math.round(avg(r => r.weaponSwapsIssued) * 10) / 10,
    avgAbilityUsageBreakdown: (() => {
      const agg: Record<string, number> = {};
      for (const r of runs) {
        for (const [ability, count] of Object.entries(r.abilityUsageBreakdown)) {
          agg[ability] = (agg[ability] ?? 0) + count / n;
        }
      }
      return agg;
    })(),
    avgNpcInteractionCount: Math.round(avg(r => r.npcInteractionCount) * 10) / 10,
    // Phase 3: Enchantments
    avgEnchantmentsApplied: Math.round(avg(r => r.enchantmentsApplied) * 10) / 10,
    avgEnchantmentGoldSpent: Math.round(avg(r => r.enchantmentGoldSpent)),
    avgEnchantmentBreakdown: (() => {
      const agg: Record<string, number> = {};
      for (const r of runs) {
        for (const [enc, count] of Object.entries(r.enchantmentBreakdown)) {
          agg[enc] = (agg[enc] ?? 0) + count / n;
        }
      }
      return agg;
    })(),
    // Phase 4: Dungeon loot tracking
    avgChestsOpened: Math.round(avg(r => r.chestsOpened) * 10) / 10,
    avgItemsFromChests: Math.round(avg(r => r.itemsFromChests) * 10) / 10,
    avgItemsFromEnemyDrops: Math.round(avg(r => r.itemsFromEnemyDrops) * 10) / 10,
    avgTotalItemsAcquired: Math.round(avg(r => r.totalItemsAcquired) * 10) / 10,
    lootToShopRatio: (() => {
      const avgDungeonLoot = avg(r => r.itemsFromChests + r.itemsFromEnemyDrops);
      const avgShopLoot = avg(r => r.shopPurchaseCount);
      return avgShopLoot > 0 ? Math.round((avgDungeonLoot / avgShopLoot) * 100) / 100 : 0;
    })(),
    avgItemsDropped: Math.round(avg(r => r.itemsDropped) * 10) / 10,
    avgItemsSoldCount: Math.round(avg(r => r.itemsSoldCount) * 10) / 10,
    avgItemsSoldGold: Math.round(avg(r => r.itemsSoldGold) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Summary Output
// ---------------------------------------------------------------------------

export function printSummary(aggregates: AggregateStats[], outFile: string, campaignLength: number, runsByStrategy?: Map<string, RunResult[]>): void {
  const ts = new Date().toISOString();
  const mode = campaignLength > 0 ? `campaign(${campaignLength})` : 'independent';
  console.log(`\nBalance Test Results — ${ts} [${mode}]`);
  console.log('='.repeat(88));
  console.log(
    'Strategy'.padEnd(12) +
    'Runs'.padEnd(6) +
    'Entries'.padEnd(9) +
    'Survive%'.padEnd(10) +
    'AvgMaxFlr'.padEnd(11) +
    'Descended'.padEnd(11) +
    'AvgTurns'.padEnd(10) +
    'D/T Ratio'.padEnd(11) +
    'Deaths%',
  );

  for (const s of aggregates) {
    const surviveF1 = s.survivalRateByFloor[1] ?? 0;
    console.log(
      s.strategy.padEnd(12) +
      String(s.totalRuns).padEnd(6) +
      String(s.avgDungeonEntries).padEnd(9) +
      `${surviveF1}%`.padEnd(10) +
      String(s.avgMaxFloorReached).padEnd(11) +
      String(s.avgFloorsDescended).padEnd(11) +
      String(s.avgTurnsElapsed).padEnd(10) +
      String(s.avgDmgRatio).padEnd(11) +
      `${s.deathRate}%`,
    );
  }

  console.log('-'.repeat(88));

  for (const s of aggregates) {
    const floors = Object.entries(s.survivalRateByFloor)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([f, pct]) => `F${f}=${pct}%`)
      .join('  ');
    if (floors) console.log(`Floor Survival (${s.strategy}): ${floors}`);

    if (s.mostCommonDeathFloor !== null) {
      const deaths = s.deathsByFloor[s.mostCommonDeathFloor] ?? 0;
      console.log(`Most Common Death Floor (${s.strategy}): Floor ${s.mostCommonDeathFloor} (${deaths} deaths)`);
    }

    // Add effectiveness metrics (DPS and EHP)
    if (runsByStrategy) {
      const strategyRuns = runsByStrategy.get(s.strategy) ?? [];
      if (strategyRuns.length > 0) {
        const { dps, ehp } = calculateEffectivenessMetrics(strategyRuns);
        console.log(`Effectiveness (${s.strategy}): DPS=${dps}/turn  EHP=${ehp}  WinRateTarget=${s.winRateTarget}% (actual=${s.victoryRate}%)`);
      }
    }

    const endReasons = [
      `death=${s.deathRate}%`,
      s.retreatRate > 0 ? `retreat=${s.retreatRate}%` : null,
      s.victoryRate > 0 ? `victory=${s.victoryRate}%` : null,
      s.maxTurnsRate > 0 ? `maxTurns=${s.maxTurnsRate}%` : null,
      s.maxEntriesRate > 0 ? `maxEntries=${s.maxEntriesRate}%` : null,
    ].filter(Boolean).join('  ');
    console.log(`End Reasons (${s.strategy}): ${endReasons}`);

    const { blade, bludgeon, axe, ranged } = s.weaponTypeUsage;
    console.log(`Weapon Usage (${s.strategy}): blade=${blade}%  bludgeon=${bludgeon}%  axe=${axe}%  ranged=${ranged}%`);

    console.log(`Economy (${s.strategy}): goldEarned=${s.avgGoldEarned}  goldSpent=${s.avgGoldSpent}  goldAtEnd=${s.avgGoldAtEnd}  shopBuys=${s.avgShopPurchases}  restCost=${s.avgRestCost}`);

    console.log(`Dungeon Loot (${s.strategy}): chests=${s.avgChestsOpened}  fromChests=${s.avgItemsFromChests}  fromEnemies=${s.avgItemsFromEnemyDrops}  totalAcquired=${s.avgTotalItemsAcquired}  loot:shop=${s.lootToShopRatio}:1`);

    console.log(`Inventory Mgmt (${s.strategy}): dropped=${s.avgItemsDropped}  sold=${s.avgItemsSoldCount}  soldGold=${s.avgItemsSoldGold}g`);

    console.log(`Gear (${s.strategy}): avgDefense=${s.avgTotalDefenseFromGear}  avgWpnDmg=${s.avgWeaponDamage}  armorSlots=${s.avgArmorSlotsFilled}/6`);

    console.log(`Mastery (${s.strategy}): abilities=${s.avgMasteryAbilities}  switches=${s.avgWeaponSwitches}  committed=${s.weaponCommitmentRate}%`);

    // Format enchantment breakdown
    const encBreakdown = Object.entries(s.avgEnchantmentBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([enc, count]) => `${enc}=${Math.round(count * 10) / 10}`)
      .join('  ');
    const encLine = encBreakdown
      ? `Enchantments (${s.strategy}): applied=${s.avgEnchantmentsApplied}  spent=${s.avgEnchantmentGoldSpent}g  [${encBreakdown}]`
      : `Enchantments (${s.strategy}): applied=${s.avgEnchantmentsApplied}  spent=${s.avgEnchantmentGoldSpent}g`;
    console.log(encLine);

    console.log(`Consumables (${s.strategy}): potions=${s.avgPotionsUsed}  wasted=${s.avgPotionsWasted}  bombs=${s.avgBombsUsed}`);

    console.log(`Progression (${s.strategy}): lvl=${s.avgPlayerLevel}  xp=${s.avgExperience}  kills=${s.avgEnemiesKilled}`);

    // Add standard deviation information
    console.log(`Variance (${s.strategy}): maxFloor(±${s.stdDevMaxFloor})  dmgDealt(±${s.stdDevDamageDealt})  dmgTaken(±${s.stdDevDamageTaken})`);

    if (s.avgWorldNemesisCount > 0) {
      console.log(`World (${s.strategy}): deepest=F${s.avgWorldDeepestFloor}  nemeses=${s.avgWorldNemesisCount}`);
    }
  }

  const nemesisLine = aggregates.map(s => `${s.strategy}=${s.nemesisEncounterRate}%`).join('  ');
  console.log(`Nemesis Rate: ${nemesisLine}`);

  // Comparison table for 2+ strategies
  if (aggregates.length >= 2) {
    printComparisonTable(aggregates);
  }

  console.log(`\nOutput: ${outFile}`);
}

/**
 * Calculate effectiveness metrics per strategy.
 * Includes DPS (damage per turn) and EHP (effective health considering defense).
 */
export function calculateEffectivenessMetrics(runs: RunResult[]): { dps: number; ehp: number } {
  if (runs.length === 0) return { dps: 0, ehp: 0 };

  const avgDamageDealt = runs.reduce((s, r) => s + r.totalDamageDealt, 0) / runs.length;
  const avgTurns = runs.reduce((s, r) => s + r.totalTurnsElapsed, 0) / runs.length;
  const dps = avgTurns > 0 ? Math.round(avgDamageDealt / avgTurns * 10) / 10 : 0;

  // EHP = health + (defense * 10) — rough estimate of effective durability
  const avgHealth = runs.reduce((s, r) => s + r.playerLevelAtEnd * 50, 0) / runs.length; // approx health
  const avgDefense = runs.reduce((s, r) => s + r.equipmentSnapshot.totalDefenseFromGear, 0) / runs.length;
  const ehp = Math.round(avgHealth + avgDefense * 10);

  return { dps, ehp };
}

export function printComparisonTable(aggregates: AggregateStats[]): void {
  const col = 12;
  const fmt = (v: number | string) => String(v).padStart(col);

  console.log('\nStrategy Comparison');
  console.log('═'.repeat(col * (aggregates.length + 1) + 28));

  const header = 'Metric'.padEnd(28) + aggregates.map(s => s.strategy.padStart(col)).join('');
  console.log(header);
  console.log('-'.repeat(col * (aggregates.length + 1) + 28));

  const row = (label: string, fn: (s: AggregateStats) => number | string) => {
    const values = aggregates.map(s => fmt(fn(s)));
    console.log(label.padEnd(28) + values.join(''));
  };

  row('Avg Floor Reached', s => s.avgMaxFloorReached);
  row('Death Rate', s => `${s.deathRate}%`);
  row('Timeout Rate', s => `${s.maxTurnsRate}%`);
  row('Avg Kills', s => s.avgEnemiesKilled);
  row('Avg Gold Earned', s => s.avgGoldEarned);
  row('Avg Gold Spent', s => s.avgGoldSpent);
  row('Shop Purchases', s => s.avgShopPurchases);
  row('Avg Gold At End', s => s.avgGoldAtEnd);
  row('Gear Defense', s => s.avgTotalDefenseFromGear);
  row('Weapon Damage', s => s.avgWeaponDamage);
  row('Armor Slots Filled', s => `${s.avgArmorSlotsFilled}/6`);
  row('Mastery Abilities', s => s.avgMasteryAbilities);
  row('Weapon Switches', s => s.avgWeaponSwitches);
  row('Commitment Rate', s => `${s.weaponCommitmentRate}%`);
  row('Potions Used', s => s.avgPotionsUsed);
  row('Potions Wasted', s => s.avgPotionsWasted);
  row('Enchantments Applied', s => s.avgEnchantmentsApplied);
  row('Enchantment Gold', s => s.avgEnchantmentGoldSpent);
  row('Chests Opened', s => s.avgChestsOpened);
  row('Items From Chests', s => s.avgItemsFromChests);
  row('Items From Enemies', s => s.avgItemsFromEnemyDrops);
  row('Total Items Acquired', s => s.avgTotalItemsAcquired);
  row('Loot to Shop Ratio', s => `${s.lootToShopRatio}:1`);
  row('Items Dropped', s => s.avgItemsDropped);
  row('Items Sold', s => s.avgItemsSoldCount);
  row('Gold From Sales', s => s.avgItemsSoldGold);
  row('Player Level', s => s.avgPlayerLevel);

  console.log('═'.repeat(col * (aggregates.length + 1) + 28));
}
