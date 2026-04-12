/**
 * index.ts — Balance test entry point
 *
 * Usage:
 *   pnpm balance                              # 100 independent sessions each: random + greedy + smart
 *   pnpm balance -- --runs 10                # 10 sessions each
 *   pnpm balance -- --strategy greedy        # greedy only
 *   pnpm balance -- --strategy smart         # mastery-aware smart strategy
 *   pnpm balance -- --strategy lm --runs 50  # LM-assisted
 *   pnpm balance -- --campaign 20            # 20-session campaign per strategy (shared world state)
 *   pnpm balance:lm                          # LM alias
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { GameEngine } from '@dungeon/core';
import type { WorldState } from '@dungeon/contracts';
import { queryLmStudio } from './lm-client.js';
import { parseArgs, writeProgressFile } from './cli.js';
import { simulateSession } from './simulation.js';
import { aggregate, printSummary } from './reporting.js';
import type { AggregateStats, RunResult, BalanceReport } from './types.js';

const MAX_ENTRIES = 50;
const MAX_TOTAL_TURNS = 50_000;

async function main(): Promise<void> {
  const { runs, strategies, seed, out, campaign } = parseArgs(process.argv);
  const startedAt = new Date().toISOString();

  const mode = campaign > 0
    ? `${runs} campaigns × ${campaign} sessions`
    : `${runs} independent sessions`;
  console.log(`Balance Test v4 — ${mode} × [${strategies.join(', ')}] (base seed: ${seed})`);
  console.log(`  Up to ${MAX_ENTRIES} dungeon entries per session, ${MAX_TOTAL_TURNS} total turns (global budget)`);
  if (campaign > 0) {
    console.log(`  Campaign mode: world state persists across ${campaign} sessions`);
  }

  let lmAvailable = false;
  if (strategies.includes('lm')) {
    process.stdout.write('Probing LM Studio... ');
    const probe = await queryLmStudio('ping');
    lmAvailable = probe.text !== null;
    console.log(lmAvailable ? 'online' : `unavailable (${probe.error ?? 'no response'}) — falling back to greedy`);
  }

  const engine = new GameEngine();
  const allResults: RunResult[] = [];

  for (const strategy of strategies) {
    if (campaign > 0) {
      // Campaign mode: `runs` campaigns, each chaining `campaign` sessions with shared world state
      console.log(`\nRunning ${runs} campaigns × ${campaign} sessions × ${strategy}...`);
      for (let c = 0; c < runs; c++) {
        let worldCarry: WorldState | null = null;
        for (let s = 0; s < campaign; s++) {
          const sessionSeed = seed + c * campaign + s;
          const { run, finalWorld } = await simulateSession(
            engine, c * campaign + s, strategy, sessionSeed, lmAvailable, c, worldCarry,
          );
          allResults.push(run);
          worldCarry = finalWorld;
          // Write progress file for dashboard after every session
          writeProgressFile(allResults, strategies, runs, out, campaign, startedAt);
        }
        if ((c + 1) % 5 === 0) process.stdout.write(`  ${c + 1}/${runs} campaigns\r`);
      }
    } else {
      // Independent sessions mode
      console.log(`\nRunning ${runs} × ${strategy}...`);
      for (let i = 0; i < runs; i++) {
        const { run } = await simulateSession(
          engine, i, strategy, seed + i, lmAvailable, 0, null,
        );
        allResults.push(run);
        if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${runs}\r`);
        // Write progress file for dashboard after every run
        writeProgressFile(allResults, strategies, runs, out, campaign, startedAt);
      }
    }
    console.log(`  done`);
  }

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
      maxTotalTurnsGlobal: MAX_TOTAL_TURNS,  // global budget across all entries
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

  const outDir = path.dirname(out);
  if (outDir && outDir !== '.') fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf-8');

  // Group runs by strategy for effectiveness metrics calculation
  const runsByStrategy = new Map<string, RunResult[]>();
  for (const run of allResults) {
    if (!runsByStrategy.has(run.strategy)) {
      runsByStrategy.set(run.strategy, []);
    }
    runsByStrategy.get(run.strategy)!.push(run);
  }

  printSummary(aggregates, out, campaign, runsByStrategy);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
