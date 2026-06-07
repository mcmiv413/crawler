#!/usr/bin/env node

/**
 * Type-check test files across all packages/apps.
 *
 * Runs tsc for each tsconfig.test.json in parallel.
 * Ignores TS6059 (cross-package rootDir) warnings from monorepo imports.
 * These warnings are expected in monorepos and don't indicate type errors.
 * Real type errors (TS1-TS5999, TS7000+) are reported and fail the check.
 * Exits with failure on first real error.
 */

import { spawn } from 'child_process';
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

console.log('🔍 Type-checking test files (parallel)...\n');

const results = new Map();
let completed = 0;
let failed = false;
let allOutput = [];

function getConfigName(config) {
  return config.split('/').slice(0, 2).join('/');
}

function runTypeCheck(config) {
  return new Promise((resolve) => {
    const fullPath = path.join(projectRoot, config);
    const configName = getConfigName(config);

    let output = '';

    const proc = spawn('tsc', ['-p', fullPath, '--noEmit'], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      results.set(configName, { code, output });
      resolve();
    });

    proc.on('error', (err) => {
      results.set(configName, { code: 1, output: err.message });
      resolve();
    });
  });
}

async function main() {
  const promises = testConfigs.map((config) => runTypeCheck(config));
  await Promise.all(promises);

  let totalErrors = 0;
  const failures = [];

  for (const config of testConfigs) {
    const configName = getConfigName(config);
    const result = results.get(configName);

    if (result.code === 0) {
      console.log(`  ✓ ${configName}`);
    } else {
      const lines = result.output.split('\n');
      // TS6059: cross-package rootDir warnings are expected in monorepos with path aliases
      // Filter out TS6059 error blocks: skip the header line AND its indented context lines
      const realErrors = [];
      let skipContextLines = false;
      for (const line of lines) {
        if (line.includes('error TS6059')) {
          skipContextLines = true;
        } else if (skipContextLines && line.startsWith('  ')) {
          // Skip indented context lines that follow TS6059 errors
          continue;
        } else if (skipContextLines && line.trim() === '') {
          // Empty line ends the TS6059 block
          skipContextLines = false;
        } else if (skipContextLines && !line.startsWith('  ')) {
          // Non-indented line ends the TS6059 block
          skipContextLines = false;
          realErrors.push(line);
        } else {
          realErrors.push(line);
        }
      }
      const realErrorCount = realErrors.filter((line) => line.includes('error TS')).length;

      if (realErrorCount > 0) {
        console.error(`  ✗ ${configName} — ${realErrorCount} error(s)`);
        failures.push({ configName, errors: realErrors });
        totalErrors += realErrorCount;
        failed = true;
        allOutput.push(`\n[${configName}]`);
        allOutput.push(...realErrors.filter((line) => line.trim()));
      } else {
        const ts6059Count = lines.filter((line) => line.includes('TS6059')).length;
        const suffix = ts6059Count > 0 ? ` (${ts6059Count} cross-package TS6059 ignored)` : '';
        console.log(`  ✓ ${configName}${suffix}`);
      }
    }
  }

  if (failed) {
    console.error(`\n❌ Type-check failed (${totalErrors} errors)\n`);

    // Write detailed log file
    if (allOutput.length > 0) {
      const fs = await import('fs');
      const logDir = '.validate-logs';
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.writeFileSync(path.join(logDir, 'typecheck.log'), allOutput.join('\n'), 'utf-8');
    }

    process.exit(1);
  } else {
    console.log('\n✅ All test files type-check successfully\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
