import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkCentralizedLiterals } from './guardrails/check-centralized-literals.mjs';
import { checkDocPaths } from './guardrails/check-doc-paths.mjs';
import { checkFileSizeHotspots } from './guardrails/check-file-size-hotspots.mjs';
import { checkOptionalImportBoundaries } from './guardrails/check-optional-import-boundaries.mjs';
import { checkReferenceLiterals } from './guardrails/check-reference-literals.mjs';
import { checkTestTopology } from './guardrails/check-test-topology.mjs';

const repoRoot = process.cwd();
const failures = [];

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
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

function expectNotMatches(relativePath, pattern, message) {
  if (pattern.test(read(relativePath))) {
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

function findExternalSrcImports(relativePath) {
  const packageRootRelativePath = relativePath.split('/src/')[0];
  const packageRootAbsolutePath = join(repoRoot, packageRootRelativePath);
  const fileAbsolutePath = join(repoRoot, relativePath);
  const matches = read(relativePath).matchAll(
    /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  );
  const externalSrcImports = [];

  for (const match of matches) {
    const specifier = match[1] ?? match[2];
    if (!specifier || specifier.startsWith('.') === false || specifier.includes('/src/') === false) {
      continue;
    }

    const resolvedImportPath = resolve(dirname(fileAbsolutePath), specifier);
    const relativeToPackageRoot = relative(packageRootAbsolutePath, resolvedImportPath);
    const leavesPackageRoot = relativeToPackageRoot === '' || relativeToPackageRoot.startsWith(`..${sep}`);
    if (leavesPackageRoot) {
      externalSrcImports.push(specifier);
    }
  }

  return externalSrcImports;
}

const packageJson = readJson('package.json');
if (!packageJson.scripts?.validate?.includes('pnpm run check:exports')) {
  failures.push('package.json: validate must include check:exports so the merge gate matches CI and docs');
}

const guardrailChecks = [
  ['test-topology', () => checkTestTopology({ rootDir: repoRoot })],
  ['optional-import-boundaries', () => checkOptionalImportBoundaries({ rootDir: repoRoot })],
  ['reference-literals', () => checkReferenceLiterals({ rootDir: repoRoot })],
  ['doc-paths', () => checkDocPaths({ rootDir: repoRoot })],
  ['centralized-literals', () => checkCentralizedLiterals({ rootDir: repoRoot })],
  ['file-size-hotspots', () => checkFileSizeHotspots({ rootDir: repoRoot })],
];

for (const [name, runCheck] of guardrailChecks) {
  try {
    const guardrailFailures = runCheck();
    failures.push(...guardrailFailures.map((failure) => `${name}: ${failure}`));
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
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

const removedDeadSurfacePaths = [
  'packages/game-core/src/engine/action-pipeline.ts',
  'packages/game-core/src/engine/action-pipeline.test.ts',
  'packages/game-core/src/abilities/requirement-validator.ts',
  'apps/web/src/components/TrapPlacementModal.tsx',
  'apps/web/src/components/InventoryPanel.tsx',
  'apps/web/src/components/InspectScreen.tsx',
  'apps/web/src/components/EquipmentOverview.tsx',
  'apps/web/src/components/dropdowns/InspectDropdown.tsx',
  'apps/web/src/components/dropdowns/SwapDropdown.tsx',
  'apps/web/src/components/ActionOverlay.tsx',
  'apps/web/src/components/DPad.tsx',
];

for (const relativePath of removedDeadSurfacePaths) {
  if (existsSync(join(repoRoot, relativePath))) {
    failures.push(`${relativePath}: dead rule/UI surface should stay removed`);
  }
}

expectNotContains(
  'packages/game-core/src/systems/index.ts',
  'getStudyableRingSpells',
  'dead studyability helper must not be re-exported',
);
expectNotMatches(
  'packages/game-core/src/systems/index.ts',
  /\bgetSchoolMasteryLevel\b/,
  'dead school mastery helper must not be re-exported',
);
expectNotContains(
  'packages/game-core/src/systems/mana.ts',
  'canAfordMana',
  'misspelled mana alias should stay removed',
);
expectNotContains(
  'packages/content/src/factions/utilities.ts',
  'getTemplateIdsForFaction',
  'dead faction helper should stay removed',
);
expectNotContains(
  'packages/content/src/factions/utilities.ts',
  'getFactionIdsForTemplate',
  'dead faction helper should stay removed',
);

const gameCoreFiles = walk('packages/game-core/src').filter(
  (relativePath) =>
    relativePath.endsWith('.ts') &&
    relativePath.includes('/testing/') === false &&
    relativePath.includes('.test.') === false &&
    relativePath.includes('.property.test.') === false &&
    relativePath.includes('.integration.test.') === false &&
    relativePath.includes('.contract.test.') === false &&
    relativePath.includes('.balance.test.') === false,
);

for (const relativePath of gameCoreFiles) {
  if (
    relativePath !== 'packages/game-core/src/engine/floor-transition-service.ts'
    && relativePath !== 'packages/game-core/src/generation/map-generator.ts'
    && /\bgenerateFloor\s*\(/.test(read(relativePath))
  ) {
    failures.push(
      `${relativePath}: generated floors must flow through floor-transition-service.ts so persistedFloorCache is checked first`,
    );
  }
}

for (const relativePath of gameCoreFiles) {
  const lines = read(relativePath).split('\n');
  lines.forEach((line, index) => {
    if (/\bDate\.now\s*\(/.test(line)) {
      failures.push(`${relativePath}:${index + 1} uses Date.now() in persisted gameplay code`);
    }
    if (/\bMath\.random\s*\(/.test(line)) {
      failures.push(`${relativePath}:${index + 1} uses Math.random() in persisted gameplay code`);
    }
  });
}

const packageLocalTestFiles = walk('packages').filter(
  (relativePath) =>
    relativePath.includes('/src/')
    && (relativePath.endsWith('.test.ts') || relativePath.endsWith('.test.tsx')),
);

for (const relativePath of packageLocalTestFiles) {
  const externalSrcImports = findExternalSrcImports(relativePath);
  for (const specifier of externalSrcImports) {
    failures.push(
      `${relativePath} imports external src path ${specifier}; use a workspace package export instead`,
    );
  }
}

const auditHelper = spawnSync(
  'pnpm',
  ['exec', 'tsx', 'scripts/audit-tests.ts'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

if (auditHelper.status !== 0) {
  failures.push(`scripts/audit-tests.ts smoke check failed: ${(auditHelper.stderr || '').trim()}`);
} else {
  const stdout = auditHelper.stdout || '';
  if (stdout.includes('### E2E Tests') && stdout.includes('Runner: Playwright-only (`pnpm test:e2e`)') === false) {
    failures.push('audit-tests: E2E tests must be reported as Playwright-only coverage');
  }
  const invalidMatch = stdout.match(/\*\*Invalid \(has errors\):\*\*\s+(\d+)/);
  const invalidCount = invalidMatch ? parseInt(invalidMatch[1], 10) : 0;
  if (invalidCount > 0) {
    const errorSection = stdout.match(/## Files with Errors \(High Priority\)\n([\s\S]*?)(?=\n##|$)/);
    if (errorSection) {
      failures.push(`audit-tests: ${invalidCount} test file(s) have errors:\n${errorSection[1].trim()}`);
    } else {
      failures.push(`audit-tests: ${invalidCount} test file(s) have errors (run scripts/audit-tests.ts for details)`);
    }
  }
}

if (failures.length > 0) {
  console.error('Audit guardrail check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Audit guardrail check passed.');
