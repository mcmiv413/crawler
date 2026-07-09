#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  matchesPathPattern,
  isExplicitGlob,
} from './guardrails/feature-proof-registry.mjs';
import { parseArgs, walkFiles } from './guardrails/common.mjs';

const DEFAULT_CONFIG_PATH = 'stryker.config.mjs';

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
}

async function loadConfig(rootDir, configPath) {
  const absolutePath = join(rootDir, configPath);
  const module = await import(`${pathToFileURL(absolutePath).href}?t=${Date.now()}`);
  return module.default ?? module.config;
}

function validateThresholds(thresholds) {
  if (thresholds === undefined || thresholds === null || typeof thresholds !== 'object') {
    return ['stryker.config.mjs must define thresholds'];
  }
  const failures = [];
  for (const key of ['high', 'low', 'break']) {
    if (typeof thresholds[key] !== 'number') {
      failures.push(`thresholds.${key} must be a number`);
    }
  }
  return failures;
}

function resolveMutationTargets(rootDir, patterns) {
  const files = walkFiles(rootDir, {
    ignoredDirs: new Set([
      '.git',
      '.agents',
      '.claude',
      '.codex',
      'node_modules',
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'balance-results',
    ]),
  });

  const positivePatterns = patterns.filter((pattern) =>
    typeof pattern === 'string' && pattern.startsWith('!') === false,
  );
  const negativePatterns = patterns
    .filter((pattern) => typeof pattern === 'string' && pattern.startsWith('!'))
    .map((pattern) => pattern.slice(1));

  const included = positivePatterns.flatMap((pattern) => {
    if (!isExplicitGlob(pattern)) {
      return existsSync(join(rootDir, pattern)) ? [pattern] : [];
    }
    return files.filter((file) => matchesPathPattern(pattern, file));
  });

  return [...new Set(included)]
    .filter((file) => negativePatterns.some((pattern) => matchesPathPattern(pattern, file)) === false)
    .sort();
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolve(typeof args.root === 'string' ? args.root : process.cwd());
  const configPath = typeof args.config === 'string' ? args.config : DEFAULT_CONFIG_PATH;
  const execute = args.execute === true || process.env.MUTATION_EXECUTE === 'true';
  const config = await loadConfig(rootDir, configPath);
  const failures = [];

  if (config === undefined || config === null || typeof config !== 'object') {
    failures.push(`${configPath} must export a config object`);
  }

  const mutate = Array.isArray(config?.mutate) ? config.mutate : [];
  if (mutate.length === 0) {
    failures.push(`${configPath} must list critical mutation targets`);
  }

  failures.push(...validateThresholds(config?.thresholds));

  const missingExactTargets = mutate.filter((pattern) =>
    typeof pattern === 'string'
    && pattern.startsWith('!') === false
    && !isExplicitGlob(pattern)
    && existsSync(join(rootDir, pattern)) === false,
  );
  for (const target of missingExactTargets) {
    failures.push(`mutation target does not exist: ${target}`);
  }

  const resolvedTargets = resolveMutationTargets(rootDir, mutate);
  if (resolvedTargets.length === 0) {
    failures.push('mutation target list resolved to zero files');
  }

  if (failures.length > 0) {
    console.error([
      'Critical mutation configuration failed.',
      '',
      ...failures.map((failure) => `- ${failure}`),
    ].join('\n'));
    process.exit(1);
  }

  if (execute) {
    const result = runCommand('pnpm', ['exec', 'stryker', 'run', configPath], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    process.exit(result.status ?? 1);
  }

  console.log([
    'Critical mutation config baseline is present; mutation testing is configured report-only and Stryker was not run.',
    `Config: ${configPath}`,
    `Critical target files resolved: ${resolvedTargets.length}`,
    `Thresholds: high ${config.thresholds.high}, low ${config.thresholds.low}, break ${config.thresholds.break}`,
    '',
    'To execute Stryker after installing @stryker-mutator/core and the Vitest runner, run:',
    'MUTATION_EXECUTE=true pnpm test:mutation:critical',
  ].join('\n'));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
