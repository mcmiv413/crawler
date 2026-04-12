#!/usr/bin/env tsx

/**
 * Balance Tuning CLI
 *
 * Usage:
 *   tsx tools/balance/cli.ts --generations 1 --dry-run
 *   tsx tools/balance/cli.ts --help
 */

import { SCENARIOS, POLICIES, aggregateMetrics, checkConstraints, scoreMetrics, recommendTuning } from './index.js';
import type { RunTelemetry } from './types.js';
import { createDefaultBalanceConfig } from '@dungeon/content';

interface CliArgs {
  generations: number;
  dryRun: boolean;
  seed?: number;
  output?: string;
  help: boolean;
}

/**
 * Parse command-line arguments.
 */
function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const result: CliArgs = {
    generations: 1,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--generations' && args[i + 1]) {
      result.generations = parseInt(args[++i] ?? '1', 10);
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--seed' && args[i + 1]) {
      result.seed = parseInt(args[++i] ?? '0', 10);
    } else if (arg === '--output' && args[i + 1]) {
      result.output = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    }
  }

  return result;
}

/**
 * Print help message.
 */
function printHelp(): void {
  console.log(`
Balance Tuning System CLI

Usage:
  tsx tools/balance/cli.ts [options]

Options:
  --generations N    Number of generations to run (default: 1)
  --dry-run          Validate setup without running simulations
  --seed N           RNG seed for reproducibility
  --output FILE      Write results to JSON file
  --help             Show this help message

Examples:
  # Validate system is working
  tsx tools/balance/cli.ts --dry-run

  # Run 5 generations with deterministic seed
  tsx tools/balance/cli.ts --generations 5 --seed 42 --output results.json

  # Quick test with 1 generation
  tsx tools/balance/cli.ts --generations 1
`);
}

/**
 * Validate balance system components are working.
 */
function validateSystem(): { passed: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check scenarios
  if (SCENARIOS.length === 0) {
    errors.push('No scenarios defined');
  } else {
    console.log(`✓ ${SCENARIOS.length} scenarios loaded`);
  }

  // Check policies
  if (POLICIES.length === 0) {
    errors.push('No policies defined');
  } else {
    console.log(`✓ ${POLICIES.length} policies loaded`);
  }

  // Check config creation
  try {
    const config = createDefaultBalanceConfig();
    if (!config.combat || !config.floorScaling) {
      errors.push('BalanceConfig missing required fields');
    } else {
      console.log('✓ BalanceConfig created successfully');
    }
  } catch (e) {
    errors.push(`Failed to create BalanceConfig: ${String(e)}`);
  }

  // Check aggregation with mock data
  try {
    const mockRuns: RunTelemetry[] = [
      {
        scenarioId: 'test',
        seed: 1,
        seedType: 'evaluation',
        policy: 'greedy',
        victory: true,
        floorReached: 5,
        turns: 50,
        damageDealt: 200,
        damageTaken: 100,
        playerHpStart: 30,
        playerHpEnd: 20,
        consumablesUsed: 1,
        nearDeathMoments: 2,
        turnsAtLowHp: 5,
        comebackEvents: [],
        comebackCount: 0,
        comebackStrength: 0,
        deaths: 0,
        encounterStats: [],
        behaviorEffectiveness: [],
      },
    ];

    const metrics = aggregateMetrics(mockRuns);
    console.log('✓ Metrics aggregation working');

    // Check constraints
    const constraintResult = checkConstraints(metrics);
    console.log(`✓ Constraint validation: ${constraintResult.passed ? 'passed' : 'failed'}`);

    // Check scoring
    const score = scoreMetrics(metrics);
    console.log(`✓ Scoring function returned: ${score}`);

    // Check recommendations
    const recs = recommendTuning(metrics);
    console.log(`✓ Recommendations engine: ${recs.length} suggestions generated`);
  } catch (e) {
    errors.push(`System validation failed: ${String(e)}`);
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║     Balance Tuning System v1.0        ║');
  console.log('╚═══════════════════════════════════════╝\n');

  // Validate system
  console.log('Validating system...\n');
  const validation = validateSystem();

  if (!validation.passed) {
    console.error('\n❌ Validation failed:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log('\n✅ System validation passed\n');

  if (args.dryRun) {
    console.log('Dry-run mode: skipping simulations');
    console.log('\nTo run full optimization:');
    console.log('  tsx tools/balance/cli.ts --generations 10 --seed 42');
    process.exit(0);
  }

  console.log(`Running ${args.generations} generation(s)...`);
  console.log(`Seed: ${args.seed ?? 'random'}`);
  console.log(`Output: ${args.output ?? 'stdout'}\n`);

  // Placeholder: actual optimization loop would run here
  console.log('⚠️  Full optimization loop not yet implemented');
  console.log('Current capabilities:');
  console.log('  ✓ Type system (RNG, BalanceConfig, Policies, Scenarios)');
  console.log('  ✓ Metrics aggregation and constraint validation');
  console.log('  ✓ Scoring function and recommendation engine');
  console.log('  ✗ Main optimization loop (pending simulator integration)');
  console.log('  ✗ Mutation and selection (ready but needs loop)');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
