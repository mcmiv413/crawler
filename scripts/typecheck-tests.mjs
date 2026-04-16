#!/usr/bin/env node

/**
 * Type-check test files across all packages/apps.
 *
 * Runs tsc for each tsconfig.test.json in sequence.
 * Exits with failure on first error.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const testConfigs = [
  'packages/game-contracts/tsconfig.test.json',
  'packages/content/tsconfig.test.json',
  'packages/presenter/tsconfig.test.json',
  'apps/server/tsconfig.test.json',
  'apps/web/tsconfig.test.json',
  'tests/tsconfig.test.json',
  'packages/game-core/tsconfig.test.json',
];

console.log('🔍 Type-checking test files...\n');

let failed = false;

for (const config of testConfigs) {
  const fullPath = path.join(projectRoot, config);
  const configName = config.split('/').slice(0, 2).join('/');

  try {
    console.log(`  ✓ ${configName}`);
    execSync(`tsc -p "${fullPath}" --noEmit`, {
      stdio: 'pipe',
      cwd: projectRoot,
    });
  } catch (error) {
    console.error(`  ✗ ${configName} — errors found`);
    console.error(error.stdout?.toString() || error.message);
    failed = true;
  }
}

if (failed) {
  console.error('\n❌ Type-check failed\n');
  process.exit(1);
} else {
  console.log('\n✅ All test files type-check successfully\n');
  process.exit(0);
}
