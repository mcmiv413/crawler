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

// ── 2. Runtime resolution ─────────────────────────────────────────────────────

const checks = [
  // Root imports
  { specifier: '@dungeon/contracts',              desc: '@dungeon/contracts root' },
  { specifier: '@dungeon/core',                   desc: '@dungeon/core root' },
  { specifier: '@dungeon/content',                desc: '@dungeon/content root' },
  { specifier: '@dungeon/presenter',              desc: '@dungeon/presenter root' },
  // Subpath imports
  { specifier: '@dungeon/core/ai/ai-service.js',  desc: '@dungeon/core/ai/ai-service.js' },
  { specifier: '@dungeon/core/ai/prompt-builders.js', desc: '@dungeon/core/ai/prompt-builders.js' },
  { specifier: '@dungeon/core/utils/pathfinding.js',  desc: '@dungeon/core/utils/pathfinding.js' },
];

let resolveErrors = 0;

for (const { specifier, desc } of checks) {
  try {
    await import(specifier);
    console.log(`OK    ${desc}`);
  } catch (err) {
    console.error(`FAIL  ${desc}`);
    console.error(`      ${err.message}`);
    resolveErrors++;
  }
}

if (resolveErrors > 0) {
  console.error(`\n${resolveErrors} package resolution error(s).`);
  console.error('Most likely cause: dist/ files not built. Run: pnpm build\n');
  process.exit(1);
}

console.log('\nAll package exports resolved successfully.');
