/**
 * analyze-session.ts — Post-run metrics analysis
 *
 * Analyzes session metrics from SQLite database or JSON files to provide insights
 * into game balance, bot performance, and system effectiveness.
 */

import { readFileSync } from 'fs';
import type { RunMetrics } from '@dungeon/contracts';

interface SessionAnalysis {
  totalRuns: number;
  avgDuration: number;
  statusInflictionRate: Record<string, number>;
  elementalDamageBreakdown: {
    fireTotal: number;
    physicalTotal: number;
    firePercentage: number;
  };
  worldStateChanges: {
    avgCorruptionShift: number;
    avgFearShift: number;
    avgProsperityShift: number;
    factionsAffected: number;
  };
  actionFrequency: {
    avgWeaponSwaps: number;
    abilityUsage: Record<string, number>;
    npcInteractions: number;
  };
}

/**
 * Analyze session metrics from a JSON balance test output file
 */
function analyzeFromBalanceTest(filePath: string): SessionAnalysis {
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  const runs = data.results || [];

  if (runs.length === 0) {
    console.warn('No runs found in file');
    return {
      totalRuns: 0,
      avgDuration: 0,
      statusInflictionRate: {},
      elementalDamageBreakdown: { fireTotal: 0, physicalTotal: 0, firePercentage: 0 },
      worldStateChanges: { avgCorruptionShift: 0, avgFearShift: 0, avgProsperityShift: 0, factionsAffected: 0 },
      actionFrequency: { avgWeaponSwaps: 0, abilityUsage: {}, npcInteractions: 0 },
    };
  }

  // Aggregate status infliction across all runs
  const statusCounts: Record<string, number> = {};
  let totalFireDamage = 0;
  let totalPhysicalDamage = 0;
  let totalCorruptionShift = 0;
  let totalFearShift = 0;
  let totalProsperityShift = 0;
  let factionsAffectedCount = 0;
  let totalWeaponSwaps = 0;
  const abilityUsageTotals: Record<string, number> = {};
  let totalNpcInteractions = 0;

  for (const run of runs) {
    // Status infliction
    for (const [status, count] of Object.entries(run.statusesInflicted || {})) {
      statusCounts[status] = (statusCounts[status] ?? 0) + (count as number);
    }

    // Elemental damage
    totalFireDamage += run.fireDamageReceived ?? 0;
    totalPhysicalDamage += run.physicalDamageReceived ?? 0;

    // World state (assuming initial values of prosperity=50, fear=10, corruption=0)
    totalCorruptionShift += (run.townCorruptionFinal ?? 0) - 0;
    totalFearShift += (run.townFearFinal ?? 0) - 10;
    totalProsperityShift += (run.townProsperityFinal ?? 0) - 50;

    if (run.factionsAtHighPower ?? 0 > 0) factionsAffectedCount++;

    // Actions
    totalWeaponSwaps += run.weaponSwapsIssued ?? 0;
    for (const [ability, count] of Object.entries(run.abilityUsageBreakdown || {})) {
      abilityUsageTotals[ability] = (abilityUsageTotals[ability] ?? 0) + (count as number);
    }
    totalNpcInteractions += run.npcInteractionCount ?? 0;
  }

  const n = runs.length;
  const totalDamage = totalFireDamage + totalPhysicalDamage;

  return {
    totalRuns: n,
    avgDuration: (runs as Array<{ totalTurnsElapsed?: number }>).reduce((sum, r) => sum + (r.totalTurnsElapsed ?? 0), 0) / n,
    statusInflictionRate: statusCounts,
    elementalDamageBreakdown: {
      fireTotal: totalFireDamage,
      physicalTotal: totalPhysicalDamage,
      firePercentage: totalDamage > 0 ? Math.round((totalFireDamage / totalDamage) * 100) : 0,
    },
    worldStateChanges: {
      avgCorruptionShift: Math.round((totalCorruptionShift / n) * 10) / 10,
      avgFearShift: Math.round((totalFearShift / n) * 10) / 10,
      avgProsperityShift: Math.round((totalProsperityShift / n) * 10) / 10,
      factionsAffected: factionsAffectedCount,
    },
    actionFrequency: {
      avgWeaponSwaps: Math.round((totalWeaponSwaps / n) * 10) / 10,
      abilityUsage: abilityUsageTotals,
      npcInteractions: totalNpcInteractions,
    },
  };
}

/**
 * Format analysis results for display
 */
function formatAnalysis(analysis: SessionAnalysis): string {
  const lines: string[] = [];
  lines.push('='.repeat(80));
  lines.push('SESSION METRICS ANALYSIS');
  lines.push('='.repeat(80));

  lines.push(`\nTotal Runs Analyzed: ${analysis.totalRuns}`);
  lines.push(`Avg Duration per Run: ${Math.round(analysis.avgDuration)} turns`);

  lines.push('\n--- Status Effect Frequency ---');
  const statusEntries = Object.entries(analysis.statusInflictionRate)
    .sort(([, a], [, b]) => (b as number) - (a as number));
  if (statusEntries.length === 0) {
    lines.push('  (No status effects applied)');
  } else {
    for (const [status, count] of statusEntries) {
      lines.push(`  ${status}: ${count} times (${Math.round((count as number / analysis.totalRuns) * 100)}% of runs)`);
    }
  }

  lines.push('\n--- Elemental Damage Breakdown ---');
  lines.push(`  Fire: ${analysis.elementalDamageBreakdown.fireTotal} damage (${analysis.elementalDamageBreakdown.firePercentage}%)`);
  lines.push(`  Physical: ${analysis.elementalDamageBreakdown.physicalTotal} damage (${100 - analysis.elementalDamageBreakdown.firePercentage}%)`);

  lines.push('\n--- World State Changes (Avg per Run) ---');
  lines.push(`  Corruption: ${analysis.worldStateChanges.avgCorruptionShift > 0 ? '+' : ''}${analysis.worldStateChanges.avgCorruptionShift}`);
  lines.push(`  Fear: ${analysis.worldStateChanges.avgFearShift > 0 ? '+' : ''}${analysis.worldStateChanges.avgFearShift}`);
  lines.push(`  Prosperity: ${analysis.worldStateChanges.avgProsperityShift > 0 ? '+' : ''}${analysis.worldStateChanges.avgProsperityShift}`);
  lines.push(`  Factions at High Power: ${analysis.worldStateChanges.factionsAffected} runs`);

  lines.push('\n--- Action Frequency ---');
  lines.push(`  Avg Weapon Swaps: ${analysis.actionFrequency.avgWeaponSwaps} per run`);
  lines.push(`  Total NPC Interactions: ${analysis.actionFrequency.npcInteractions}`);

  const abilityEntries = Object.entries(analysis.actionFrequency.abilityUsage)
    .sort(([, a], [, b]) => (b as number) - (a as number));
  if (abilityEntries.length > 0) {
    lines.push('  Ability Usage:');
    for (const [ability, count] of abilityEntries) {
      lines.push(`    ${ability}: ${count} times`);
    }
  }

  lines.push('\n' + '='.repeat(80));
  return lines.join('\n');
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/analyze-session.ts <path-to-balance-results.json>');
  process.exit(1);
}

const filePath = args[0];
try {
  const analysis = analyzeFromBalanceTest(filePath);
  console.log(formatAnalysis(analysis));
} catch (err) {
  console.error('Error analyzing metrics:', err instanceof Error ? err.message : err);
  process.exit(1);
}
