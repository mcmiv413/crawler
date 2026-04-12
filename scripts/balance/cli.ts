/**
 * cli.ts — Command-line argument parsing and progress file writing
 */

import * as fs from 'node:fs';
import { randomInt } from 'node:crypto';
import type { AggregateStats, BalanceReport, CliArgs, RunResult } from './types.js';
import { aggregate } from './reporting.js';

const MAX_ENTRIES = 50;
const MAX_TOTAL_TURNS = 50_000;

export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let runs = 100;
  const strategies: Array<'random' | 'greedy' | 'smart' | 'lm'> = [];
  let seed = randomInt(0, 100_000);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  let out = `balance-results/balance-${ts}.json`;
  let campaign = 0;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--runs' && args[i + 1]) {
      runs = parseInt(args[++i]!, 10);
    } else if (arg === '--strategy' && args[i + 1]) {
      strategies.push(args[++i] as 'random' | 'greedy' | 'smart' | 'lm');
    } else if (arg === '--seed' && args[i + 1]) {
      seed = parseInt(args[++i]!, 10);
    } else if (arg === '--out' && args[i + 1]) {
      out = args[++i]!;
    } else if (arg === '--campaign' && args[i + 1]) {
      campaign = parseInt(args[++i]!, 10);
    }
  }

  if (strategies.length === 0) strategies.push('random', 'greedy', 'smart');

  return { runs, strategies, seed, out, campaign };
}

/**
 * Write progress update file for dashboard monitoring.
 * This allows the dashboard to show real-time progress without waiting for final results.
 */
export function writeProgressFile(
  allResults: RunResult[],
  strategies: string[],
  runs: number,
  out: string,
  campaign: number,
  startedAt: string,
): void {
  const progressFile = out.replace('.json', '.progress.json');
  const aggregates: AggregateStats[] = strategies.map(s =>
    aggregate(allResults.filter(r => r.strategy === s)),
  );

  const report: BalanceReport = {
    generatedAt: new Date().toISOString(),
    startedAt,
    scriptVersion: '4.0.0',
    runsPerStrategy: runs,
    campaignLength: campaign,
    strategies,
    results: allResults,
    aggregates,
    metadata: {
      nodeVersion: process.version,
      maxEntriesPerSession: MAX_ENTRIES,
      maxTotalTurnsGlobal: MAX_TOTAL_TURNS,
      isProgress: true, // Mark as progress file
      balanceSnapshot: {
        baseMaxHealth: 100,
        baseAttack: 12,
        baseDefense: 5,
        floorHealthMult: 1.15,
        floorAttackMult: 1.10,
        defenseDivisor: 50,
      },
    },
  };

  try {
    fs.writeFileSync(progressFile, JSON.stringify(report, null, 2), 'utf-8');
  } catch (e) {
    // Silently fail if we can't write progress file
  }
}
