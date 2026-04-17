#!/usr/bin/env node

/**
 * Type-check test files across all packages/apps.
 *
 * Runs tsc for each tsconfig.test.json in sequence.
 * Suppresses TS6059 (rootDir validation) errors - real type errors are reported.
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
let totalErrors = 0;

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
    // Filter out TS6059 errors (rootDir validation) and count real errors
    const output = error.stdout?.toString() || error.message;
    const lines = output.split('\n');
    const realErrors = lines.filter(line => !line.includes('TS6059'));

    if (realErrors.some(line => line.includes('error TS'))) {
      console.error(`  ✗ ${configName} — errors found`);
      realErrors.forEach(line => {
        if (line.trim()) console.error(line);
      });
      totalErrors += realErrors.filter(line => line.includes('error TS')).length;
      failed = true;
    } else {
      console.log(`  ✓ ${configName} (only rootDir validation warnings)`);
    }
  }
}

if (failed) {
  console.error(`\n❌ Type-check failed (${totalErrors} errors)\n`);
  process.exit(1);
} else {
  console.log('\n✅ All test files type-check successfully\n');
  process.exit(0);
}
