#!/usr/bin/env node

/**
 * Consolidated Balance Test Dashboard
 *
 * Features:
 * - Real-time progress tracking (watch mode or single run)
 * - Compact strategy comparison table
 * - Health score + top issues (max 3 per strategy)
 * - TTY detection: refresh cleanly in terminal, print once to non-TTY
 * - Elapsed time calculated from startedAt (stable, not generatedAt)
 */

import fs from 'fs';
import path from 'path';

const RESULTS_DIR = path.join(process.cwd(), 'balance-results');

// Local type definitions (previously imported from contracts)
interface RunMetrics {
  damageDealt: number;
  kills: number;
  itemsAcquired: number;
  floorsCleared: number;
}

interface RunResult {
  runIndex: number;
  strategy: 'random' | 'greedy' | 'smart' | 'lm';
  campaignIndex: number;
  dungeonEntries: number;
  sessionEndReason: 'death' | 'retreat' | 'victory' | 'permadeath' | 'max_turns' | 'max_entries';
  maxFloorReached: number;
  totalTurnsElapsed: number;
  totalDamageDealt: number;
  totalEnemiesKilled: number;
  totalGoldEarned: number;
  playerLevelAtEnd: number;
  equipmentSnapshot: { totalDefenseFromGear: number };
}

interface AggregateStats {
  strategy: string;
  totalRuns: number;
  avgMaxFloorReached: number;
  stdDevMaxFloor: number;
  avgTurnsElapsed: number;
  avgDamageDealt: number;
  avgEnemiesKilled: number;
  deathRate: number;
  victoryRate: number;
  avgGoldEarned: number;
  avgPlayerLevel: number;
}

interface BalanceReport {
  generatedAt: string;
  startedAt?: string;
  scriptVersion: string;
  runsPerStrategy: number;
  strategies: string[];
  results: RunResult[];
  aggregates: AggregateStats[];
  metadata?: {
    maxTotalTurnsGlobal?: number;
    isProgress?: boolean;
  };
}

function getLatestBalanceFile(): string | null {
  try {
    const files = fs.readdirSync(RESULTS_DIR)
      .filter(f => f.startsWith('balance-') && (f.endsWith('.json') || f.endsWith('.progress.json')))
      .map(f => {
        const fullPath = path.join(RESULTS_DIR, f);
        const stat = fs.statSync(fullPath);
        return { path: fullPath, mtime: stat.mtimeMs, isProgress: f.endsWith('.progress.json') };
      })
      .sort((a, b) => {
        // Prefer progress files if less than 2 minutes old, otherwise use most recent
        const aIsRecent = a.isProgress && (Date.now() - a.mtime < 120000);
        const bIsRecent = b.isProgress && (Date.now() - b.mtime < 120000);
        if (aIsRecent && !bIsRecent) return -1;
        if (!aIsRecent && bIsRecent) return 1;
        return b.mtime - a.mtime;
      });
    return files.length > 0 ? files[0].path : null;
  } catch {
    return null;
  }
}

function parseBalanceReport(filePath: string): BalanceReport | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function formatTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function calculateHealthScore(stats: AggregateStats): { score: number; color: string } {
  // Health score: balance between floor reach (60%) and survival (40%)
  const floorScore = Math.min(stats.avgMaxFloorReached / 5, 1) * 60;
  const survivalScore = stats.victoryRate * 40;
  const score = Math.round(floorScore + survivalScore);

  if (score >= 80) return { score, color: '🟢' };
  if (score >= 60) return { score, color: '🟡' };
  return { score, color: '🔴' };
}

function getTopIssues(stats: AggregateStats, results: RunResult[]): string[] {
  const issues = [];

  // Low victory rate
  if (stats.victoryRate < 0.3) issues.push(`Low victory (${Math.round(stats.victoryRate * 100)}%)`);

  // High death rate
  if (stats.deathRate > 0.6) issues.push(`High death (${Math.round(stats.deathRate * 100)}%)`);

  // Floor plateau
  if (stats.avgMaxFloorReached < 2) issues.push(`Low floor reach (${stats.avgMaxFloorReached.toFixed(1)})`);

  return issues.slice(0, 3);
}

function displayDashboard(report: BalanceReport): void {
  const totalExpectedRuns = report.runsPerStrategy * report.strategies.length;
  const completedRuns = report.results.length;
  const progress = Math.round((completedRuns / totalExpectedRuns) * 100);

  // Elapsed time: use startedAt if available, fallback to generatedAt
  const startTime = new Date(report.startedAt || report.generatedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - startTime.getTime();
  const elapsedStr = formatTime(elapsedMs);

  console.log('🎮 BALANCE TEST DASHBOARD\n');
  console.log(`📊 Progress: ${completedRuns}/${totalExpectedRuns} (${progress}%) | ⏱️  ${elapsedStr}\n`);

  // Strategy comparison table
  console.log('STRATEGY COMPARISON');
  console.log('─'.repeat(90));
  console.log(
    'Strategy'.padEnd(12) +
    'Floor'.padEnd(12) +
    'Victory'.padEnd(12) +
    'Deaths'.padEnd(12) +
    'Avg Dmg'.padEnd(12) +
    'Avg Gold'.padEnd(12) +
    'Health'
  );
  console.log('─'.repeat(90));

  for (const stats of report.aggregates) {
    const { score, color } = calculateHealthScore(stats);
    const issues = getTopIssues(stats, report.results.filter(r => r.strategy === stats.strategy));

    console.log(
      stats.strategy.padEnd(12) +
      stats.avgMaxFloorReached.toFixed(1).padEnd(12) +
      `${Math.round(stats.victoryRate * 100)}%`.padEnd(12) +
      `${Math.round(stats.deathRate * 100)}%`.padEnd(12) +
      stats.avgDamageDealt.toFixed(0).padEnd(12) +
      stats.avgGoldEarned.toFixed(0).padEnd(12) +
      `${color} ${score}`
    );

    if (issues.length > 0) {
      console.log(`  ⚠️  ${issues.join(' | ')}`);
    }
  }

  console.log('');
}

async function main(): Promise<void> {
  const watchMode = process.argv.includes('--watch');
  const isTTY = process.stdout.isTTY;

  const runOnce = async () => {
    const latestFile = getLatestBalanceFile();
    if (!latestFile) {
      console.log('No balance test results found. Run: pnpm balance');
      return;
    }

    const report = parseBalanceReport(latestFile);
    if (!report) {
      console.log('Failed to parse balance report.');
      return;
    }

    if (isTTY && watchMode) {
      console.clear();
    }
    displayDashboard(report);
  };

  if (watchMode && isTTY) {
    // Watch mode: refresh every 2 seconds
    console.log('Starting watch mode (Ctrl+C to exit)...\n');
    await runOnce();
    const interval = setInterval(() => { void runOnce(); }, 2000);
    process.on('SIGINT', () => {
      clearInterval(interval);
      process.exit(0);
    });
  } else {
    // Single run: print once and exit
    await runOnce();
  }
}

main().catch(console.error);
