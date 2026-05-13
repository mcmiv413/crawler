/**
 * Validates workspace package exports two ways:
 *
 * 1. Structural lint: every export condition object must have "types" before
 *    "default" (Node processes conditions in declaration order; "default" is a
 *    catch-all that should always come last).
 *
 * 2. Runtime resolution: dynamically imports each declared export specifier so
 *    Node — not Vitest — proves the dist files actually exist and are loadable.
 *    This catches "dist missing" errors that local runs mask with leftover builds.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspacePackages = [
  'packages/game-contracts/package.json',
  'packages/game-core/package.json',
  'packages/content/package.json',
  'packages/presenter/package.json',
];

const packageDistMap = {
  contracts: 'packages/game-contracts/dist',
  core: 'packages/game-core/dist',
  content: 'packages/content/dist',
  presenter: 'packages/presenter/dist',
};

const checks = [
  { pkg: 'contracts', specifier: '@dungeon/contracts', desc: '@dungeon/contracts root' },
  { pkg: 'core', specifier: '@dungeon/core', desc: '@dungeon/core root' },
  { pkg: 'content', specifier: '@dungeon/content', desc: '@dungeon/content root' },
  { pkg: 'presenter', specifier: '@dungeon/presenter', desc: '@dungeon/presenter root' },
  { pkg: 'core', specifier: '@dungeon/core/ai/ai-service.js', desc: '@dungeon/core/ai/ai-service.js' },
  { pkg: 'core', specifier: '@dungeon/core/ai/prompt-builders.js', desc: '@dungeon/core/ai/prompt-builders.js' },
  { pkg: 'core', specifier: '@dungeon/core/utils/pathfinding.js', desc: '@dungeon/core/utils/pathfinding.js' },
  { pkg: 'core', specifier: '@dungeon/core/testing.js', desc: '@dungeon/core/testing.js' },
];

export function resolveRepoRoot(argv = process.argv.slice(2)) {
  const rootFlagIndex = argv.indexOf('--root');
  if (rootFlagIndex === -1) {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  }

  const providedRoot = argv[rootFlagIndex + 1];
  if (!providedRoot) {
    throw new Error('Missing value for --root.');
  }

  return path.resolve(providedRoot);
}

function checkExportOrdering(repoRoot) {
  let lintErrors = 0;

  for (const relPath of workspacePackages) {
    const fullPath = path.resolve(repoRoot, relPath);
    const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const exportsMap = json.exports ?? {};

    for (const [key, value] of Object.entries(exportsMap)) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;

      const keys = Object.keys(value);
      const defaultIdx = keys.indexOf('default');
      const typesIdx = keys.indexOf('types');

      if (defaultIdx !== -1 && typesIdx !== -1 && typesIdx > defaultIdx) {
        console.error(
          `FAIL  ${relPath}  "${key}": "types" (pos ${typesIdx}) comes after "default" (pos ${defaultIdx})`,
        );
        lintErrors++;
      }
    }
  }

  if (lintErrors > 0) {
    throw new Error(
      `\n${lintErrors} export map ordering error(s). Fix: move "types" before "default" in each entry.\n`,
    );
  }

  console.log('OK    export map ordering');
}

async function checkRuntimeResolution(repoRoot) {
  const serverPackageJson = path.resolve(repoRoot, 'apps/server/package.json');
  const serverRequire = createRequire(serverPackageJson);
  let resolveErrors = 0;

  for (const { pkg, specifier, desc } of checks) {
    const distDir = path.resolve(repoRoot, packageDistMap[pkg]);

    if (!fs.existsSync(distDir)) {
      console.error(`FAIL  ${desc}`);
      console.error(`      [build output missing] dist/ directory not found: ${distDir}`);
      resolveErrors++;
      continue;
    }

    let resolvedPath;
    try {
      resolvedPath = serverRequire.resolve(specifier);
    } catch (err) {
      console.error(`FAIL  ${desc}`);
      console.error(`      [workspace consumer cannot resolve] ${err.message}`);
      resolveErrors++;
      continue;
    }

    try {
      await import(pathToFileURL(resolvedPath).href);
      console.log(`OK    ${desc}`);
    } catch (err) {
      console.error(`FAIL  ${desc}`);
      console.error(`      [exported runtime module is invalid] ${err.message}`);
      resolveErrors++;
    }
  }

  if (resolveErrors > 0) {
    throw new Error(`\n${resolveErrors} package export validation error(s).\n`);
  }
}

export async function checkPackageExports(repoRoot = resolveRepoRoot()) {
  checkExportOrdering(repoRoot);
  await checkRuntimeResolution(repoRoot);
  console.log('\nAll package exports validated successfully from consumer context.');
}

async function runCli() {
  try {
    await checkPackageExports(resolveRepoRoot(process.argv.slice(2)));
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(String(err));
    }
    process.exit(1);
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  await runCli();
}
