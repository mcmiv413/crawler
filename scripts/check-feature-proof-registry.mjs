#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  DEFAULT_FEATURE_PROOF_REGISTRY_PATH,
  parseFeatureProofRegistry,
  validateFeatureProofRegistry,
} from './guardrails/feature-proof-registry.mjs';
import { assertRepoRelativePath, isCliMain, parseArgs } from './guardrails/common.mjs';

export function checkFeatureProofRegistry({
  rootDir = process.cwd(),
  registryPath = DEFAULT_FEATURE_PROOF_REGISTRY_PATH,
} = {}) {
  const absoluteRoot = resolve(rootDir);
  const normalizedRegistryPath = assertRepoRelativePath(
    registryPath,
    'feature proof registry path',
  );
  const source = readFileSync(join(absoluteRoot, normalizedRegistryPath), 'utf8');
  const registry = parseFeatureProofRegistry(source);
  const failures = validateFeatureProofRegistry({
    rootDir: absoluteRoot,
    registry,
  });

  return {
    registry,
    failures,
    registryPath: normalizedRegistryPath,
  };
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const result = checkFeatureProofRegistry({
    rootDir: typeof args.root === 'string' ? args.root : process.cwd(),
    registryPath: typeof args.registry === 'string'
      ? args.registry
      : DEFAULT_FEATURE_PROOF_REGISTRY_PATH,
  });

  if (result.failures.length > 0) {
    console.error([
      'Feature proof registry validation failed.',
      `Registry: ${result.registryPath}`,
      '',
      ...result.failures.map((failure) => `- ${failure}`),
    ].join('\n'));
    process.exit(1);
  }

  console.log(
    `Feature proof registry validation passed for ${result.registry.features.length} feature(s).`,
  );
}

if (isCliMain(import.meta.url)) {
  try {
    run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error([
      'Blocked: feature proof registry could not be validated',
      '',
      'Found:',
      `  ${message}`,
      '',
      'Repair:',
      '  Fix docs/feature-proofs.yml, then rerun pnpm run check:feature-proof-registry.',
    ].join('\n'));
    process.exit(1);
  }
}
