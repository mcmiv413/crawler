#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  matchesPathPattern,
  isExplicitGlob,
} from './guardrails/feature-proof-registry.mjs';
import {
  assertRepoRelativePath,
  formatRepoRelativePathFailure,
  isCliMain,
  isRepoRelativePath,
  normalizePath,
  parseArgs,
  walkFiles,
} from './guardrails/common.mjs';

const DEFAULT_CONFIG_PATH = 'stryker.config.mjs';

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
}

async function loadConfig(rootDir, configPath) {
  const absolutePath = join(rootDir, assertRepoRelativePath(configPath, 'critical mutation config path'));
  const module = await import(`${pathToFileURL(absolutePath).href}?t=${Date.now()}`);
  return module.default ?? module.config;
}

function validateThresholds(thresholds) {
  if (thresholds === undefined || thresholds === null || typeof thresholds !== 'object') {
    return ['stryker.config.mjs must define thresholds'];
  }
  return ['high', 'low', 'break'].flatMap((key) =>
    typeof thresholds[key] === 'number' ? [] : [`thresholds.${key} must be a number`],
  );
}

function mutationPath(pattern) {
  return pattern.startsWith('!') ? pattern.slice(1) : pattern;
}

function isValidMutationPattern(pattern) {
  return typeof pattern === 'string' && isRepoRelativePath(mutationPath(pattern));
}

function validateMutationPatterns(patterns) {
  return patterns.flatMap((pattern) =>
    isValidMutationPattern(pattern)
      ? []
      : [`Invalid critical mutation target: ${formatRepoRelativePathFailure(pattern, 'mutation target')}`],
  );
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
    typeof pattern === 'string' && pattern.startsWith('!') === false && isRepoRelativePath(pattern),
  );
  const negativePatterns = patterns
    .filter((pattern) => typeof pattern === 'string' && pattern.startsWith('!') && isRepoRelativePath(mutationPath(pattern)))
    .map((pattern) => normalizePath(mutationPath(pattern)));

  const included = positivePatterns.flatMap((pattern) => {
    const normalizedPattern = normalizePath(pattern);
    if (!isExplicitGlob(normalizedPattern)) {
      return existsSync(join(rootDir, normalizedPattern)) ? [normalizedPattern] : [];
    }
    return files.filter((file) => matchesPathPattern(normalizedPattern, file));
  });

  return [...new Set(included)]
    .filter((file) => negativePatterns.some((pattern) => matchesPathPattern(pattern, file)) === false)
    .sort();
}

export async function checkCriticalMutationConfig({
  rootDir = process.cwd(),
  configPath: requestedConfigPath = DEFAULT_CONFIG_PATH,
} = {}) {
  const absoluteRoot = resolve(rootDir);
  const configPath = assertRepoRelativePath(requestedConfigPath, 'critical mutation config path');
  const config = await loadConfig(absoluteRoot, configPath);

  const mutate = Array.isArray(config?.mutate) ? config.mutate : [];
  const mutationPatternFailures = validateMutationPatterns(mutate);
  const validMutate = mutate.filter(isValidMutationPattern);
  const missingExactTargets = validMutate.filter((pattern) =>
    typeof pattern === 'string'
    && pattern.startsWith('!') === false
    && !isExplicitGlob(pattern)
    && existsSync(join(absoluteRoot, normalizePath(pattern))) === false,
  );
  const resolvedTargets = resolveMutationTargets(absoluteRoot, validMutate);
  const failures = [
    ...(config === undefined || config === null || typeof config !== 'object'
      ? [`${configPath} must export a config object`]
      : []),
    ...(mutate.length === 0 ? [`${configPath} must list critical mutation targets`] : []),
    ...validateThresholds(config?.thresholds),
    ...mutationPatternFailures,
    ...missingExactTargets.map((target) => `mutation target does not exist: ${target}`),
    ...(mutationPatternFailures.length === 0 && resolvedTargets.length === 0
      ? ['mutation target list resolved to zero files']
      : []),
  ];

  return {
    config,
    configPath,
    failures,
    resolvedTargets,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolve(typeof args.root === 'string' ? args.root : process.cwd());
  const requestedConfigPath = typeof args.config === 'string' ? args.config : DEFAULT_CONFIG_PATH;
  const execute = args.execute === true || process.env.MUTATION_EXECUTE === 'true';
  const {
    config,
    configPath,
    failures,
    resolvedTargets,
  } = await checkCriticalMutationConfig({
    rootDir,
    configPath: requestedConfigPath,
  });

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

if (isCliMain(import.meta.url)) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
