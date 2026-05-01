import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const failures = [];

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function expectContains(relativePath, needle, message) {
  if (!read(relativePath).includes(needle)) {
    failures.push(`${relativePath}: ${message}`);
  }
}

function expectNotContains(relativePath, needle, message) {
  if (read(relativePath).includes(needle)) {
    failures.push(`${relativePath}: ${message}`);
  }
}

function walk(relativePath) {
  const absolutePath = join(repoRoot, relativePath);
  const entries = readdirSync(absolutePath, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    const childRelativePath = join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files = [...files, ...walk(childRelativePath)];
    } else {
      files.push(childRelativePath);
    }
  }

  return files;
}

expectContains(
  '.github/workflows/test-validation.yml',
  'pnpm validate',
  'workflow must enforce the repository validation gate',
);
expectContains(
  'eslint.config.mjs',
  '"dungeon/no-numeric-toBe": "error"',
  'numeric literal .toBe assertions in game-core system tests must remain merge-blocking',
);
expectNotContains(
  'packages/game-contracts/src/types/common.ts',
  "'prepare'",
  'dead prepare action should not remain in the public contract surface',
);
expectNotContains(
  'packages/game-contracts/src/schemas/index.ts',
  "'prepare'",
  'dead prepare action should not remain in the command schema',
);
expectNotContains(
  'packages/game-core/src/systems/town.ts',
  "case 'prepare':",
  'dead prepare branch should not remain in core town handling',
);

if (existsSync(join(repoRoot, 'tools', 'balance'))) {
  failures.push('tools/balance: orphaned placeholder balance tooling should be removed from the active repo surface');
}

const gameCoreFiles = walk('packages/game-core/src').filter(
  (relativePath) =>
    relativePath.endsWith('.ts') &&
    relativePath.includes('.test.') === false &&
    relativePath.includes('.property.test.') === false &&
    relativePath.includes('.integration.test.') === false &&
    relativePath.includes('.contract.test.') === false &&
    relativePath.includes('.balance.test.') === false,
);

for (const relativePath of gameCoreFiles) {
  const lines = read(relativePath).split('\n');
  lines.forEach((line, index) => {
    if (line.includes('Date.now(')) {
      failures.push(`${relativePath}:${index + 1} uses Date.now() in persisted gameplay code`);
    }
  });
}

const auditHelper = spawnSync(
  'pnpm',
  ['exec', 'tsx', 'scripts/audit-tests.ts'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe'],
  },
);

if (auditHelper.status !== 0) {
  failures.push(`scripts/audit-tests.ts smoke check failed: ${(auditHelper.stderr || '').trim()}`);
}

if (failures.length > 0) {
  console.error('Audit guardrail check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Audit guardrail check passed.');
