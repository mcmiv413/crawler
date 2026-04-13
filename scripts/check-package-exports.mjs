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
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// ── 1. Structural lint ────────────────────────────────────────────────────────

const workspacePackages = [
  'packages/game-contracts/package.json',
  'packages/game-core/package.json',
  'packages/content/package.json',
  'packages/presenter/package.json',
];

let lintErrors = 0;

for (const relPath of workspacePackages) {
  const fullPath = path.resolve(root, relPath);
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const exportsMap = json.exports ?? {};

  for (const [key, value] of Object.entries(exportsMap)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;

    const keys = Object.keys(value);
    const defaultIdx = keys.indexOf('default');
    const typesIdx = keys.indexOf('types');

    if (defaultIdx !== -1 && typesIdx !== -1 && typesIdx > defaultIdx) {
      console.error(`FAIL  ${relPath}  "${key}": "types" (pos ${typesIdx}) comes after "default" (pos ${defaultIdx})`);
      lintErrors++;
    }
  }
}

if (lintErrors > 0) {
  console.error(`\n${lintErrors} export map ordering error(s). Fix: move "types" before "default" in each entry.\n`);
  process.exit(1);
}

console.log('OK    export map ordering');

// ── 2. Runtime resolution from consumer context ───────────────────────────────

// Import from apps/server package context (a real monorepo consumer)
const serverPackageJson = path.resolve(root, 'apps/server/package.json');
const serverRequire = createRequire(serverPackageJson);

// Map packages to their dist directories
const packageDistMap = {
  contracts: 'packages/game-contracts/dist',
  core:      'packages/game-core/dist',
  content:   'packages/content/dist',
  presenter: 'packages/presenter/dist',
};

const checks = [
  // Root imports
  { pkg: 'contracts', specifier: '@dungeon/contracts',              desc: '@dungeon/contracts root' },
  { pkg: 'core',      specifier: '@dungeon/core',                   desc: '@dungeon/core root' },
  { pkg: 'content',   specifier: '@dungeon/content',                desc: '@dungeon/content root' },
  { pkg: 'presenter', specifier: '@dungeon/presenter',              desc: '@dungeon/presenter root' },
  // Subpath imports
  { pkg: 'core',      specifier: '@dungeon/core/ai/ai-service.js',  desc: '@dungeon/core/ai/ai-service.js' },
  { pkg: 'core',      specifier: '@dungeon/core/ai/prompt-builders.js', desc: '@dungeon/core/ai/prompt-builders.js' },
  { pkg: 'core',      specifier: '@dungeon/core/utils/pathfinding.js',  desc: '@dungeon/core/utils/pathfinding.js' },
];

let resolveErrors = 0;

for (const { pkg, specifier, desc } of checks) {
  const distDir = path.resolve(root, packageDistMap[pkg]);

  // Check 1: Verify dist directory exists
  if (!fs.existsSync(distDir)) {
    console.error(`FAIL  ${desc}`);
    console.error(`      [build output missing] dist/ directory not found: ${distDir}`);
    resolveErrors++;
    continue;
  }

  // Check 2: Resolve from consumer package context
  let resolvedPath;
  try {
    resolvedPath = serverRequire.resolve(specifier);
  } catch (err) {
    console.error(`FAIL  ${desc}`);
    console.error(`      [workspace consumer cannot resolve] ${err.message}`);
    resolveErrors++;
    continue;
  }

  // Check 3: Import from resolved path
  try {
    const fileUrl = pathToFileURL(resolvedPath).href;
    await import(fileUrl);
    console.log(`OK    ${desc}`);
  } catch (err) {
    console.error(`FAIL  ${desc}`);
    console.error(`      [exported runtime module is invalid] ${err.message}`);
    resolveErrors++;
  }
}

if (resolveErrors > 0) {
  console.error(`\n${resolveErrors} package export validation error(s).\n`);
  process.exit(1);
}

console.log('\nAll package exports validated successfully from consumer context.');
