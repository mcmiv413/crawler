/**
 * Test layer: integration
 * Behavior: feature-proof and test-quality guardrails classify changed production surfaces, match registry globs, traverse AST nodes in order, honor narrow allowlists, and validate the registry in temp git fixtures.
 * Proof: Assertions run the CLI scripts against staged, unstaged, committed, and untracked fixture diffs, exercise exported helper contracts, and check failure text for missing proof categories, registry context, and invalid registry entries.
 * Validation: pnpm vitest run tests/integration/feature-proof-guardrails.integration.test.ts
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBrowserFacingPath } from '../../scripts/guardrails/browser-facing.mjs';
import { matchesPathPattern } from '../../scripts/guardrails/feature-proof-registry.mjs';
import { collectTestCases, collectVitestCalls, createSourceFile } from '../../scripts/guardrails/test-quality-ast.mjs';

const FEATURE_PROOFS_SCRIPT = fileURLToPath(new URL('../../scripts/check-feature-proofs.mjs', import.meta.url));
const REGISTRY_SCRIPT = fileURLToPath(new URL('../../scripts/check-feature-proof-registry.mjs', import.meta.url));
const BROWSER_FACING_SCRIPT = fileURLToPath(new URL('../../scripts/guardrails/browser-facing.mjs', import.meta.url));
const TEST_VALIDATION_WORKFLOW = fileURLToPath(new URL('../../.github/workflows/test-validation.yml', import.meta.url));

const tempDirs: string[] = [];

function makeTempRoot(label: string): string {
  const rootDir = mkdtempSync(join(tmpdir(), `${label}-`));
  tempDirs.push(rootDir);
  return rootDir;
}

function writeFixture(rootDir: string, relativePath: string, source: string): void {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
}

function runGit(rootDir: string, args: string[]): void {
  const result = spawnSync('git', ['-C', rootDir, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
  }
}

function initRepo(rootDir: string): void {
  runGit(rootDir, ['init', '--quiet']);
  runGit(rootDir, ['checkout', '--quiet', '-b', 'main']);
  runGit(rootDir, ['config', 'user.email', 'test@example.com']);
  runGit(rootDir, ['config', 'user.name', 'Test User']);
}

function commitAll(rootDir: string, message = 'fixture'): void {
  runGit(rootDir, ['add', '.']);
  runGit(rootDir, ['commit', '--quiet', '-m', message]);
}

function runFeatureProofs(rootDir: string) {
  return spawnSync(process.execPath, [FEATURE_PROOFS_SCRIPT, '--root', rootDir, '--base', 'main'], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

function runRegistryCheck(rootDir: string) {
  return spawnSync(process.execPath, [REGISTRY_SCRIPT, '--root', rootDir], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

function runBrowserFacingMatcher(paths: string[]) {
  return spawnSync(process.execPath, [BROWSER_FACING_SCRIPT], {
    encoding: 'utf8',
    input: paths.join('\n'),
  });
}

function seedGameplayRepo(rootDir: string): void {
  initRepo(rootDir);
  writeFixture(rootDir, 'packages/game-core/src/systems/town.ts', 'export const town = "baseline";\n');
  writeFixture(rootDir, 'packages/game-core/src/systems/combat.ts', 'export const combat = "baseline";\n');
  writeFixture(rootDir, 'packages/presenter/src/game-view-builder.ts', 'export const view = "baseline";\n');
  writeFixture(rootDir, 'apps/web/src/components/TownPhase.tsx', 'export const TownPhase = () => null;\n');
  commitAll(rootDir);
}

function writeCombatFeatureRegistry(rootDir: string): void {
  writeFixture(
    rootDir,
    'docs/feature-proofs.yml',
    [
      'features:',
      '  - feature: combat-resolution',
      '    name: Combat resolution',
      '    state:',
      '      files:',
      '        - packages/game-core/src/systems/combat.ts',
      '    proofs:',
      '      required:',
      '        - packages/game-core/src/systems/combat.test.ts',
      '      optional:',
      '        - tests/integration/combat.integration.test.ts',
      '    validation:',
      '      focused:',
      '        - pnpm vitest run packages/game-core/src/systems/combat.test.ts',
      '      final:',
      '        - pnpm validate',
      '',
    ].join('\n'),
  );
}

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('guardrail helper contracts', () => {
  it('matches brace alternation glob patterns', () => {
    expect(matchesPathPattern('*.{ts,tsx}', 'a.ts')).toBe(true);
    expect(matchesPathPattern('*.{ts,tsx}', 'a.tsx')).toBe(true);
    expect(matchesPathPattern('*.{ts,tsx}', 'a.js')).toBe(false);
  });

  it('matches character class glob patterns', () => {
    expect(matchesPathPattern('file-[ab].ts', 'file-a.ts')).toBe(true);
    expect(matchesPathPattern('file-[ab].ts', 'file-b.ts')).toBe(true);
    expect(matchesPathPattern('file-[ab].ts', 'file-c.ts')).toBe(false);
    expect(matchesPathPattern('file-[!c].ts', 'file-a.ts')).toBe(true);
    expect(matchesPathPattern('file-[!c].ts', 'file-c.ts')).toBe(false);
  });

  it('preserves literal, star, and globstar path matching', () => {
    expect(matchesPathPattern('packages/presenter/src/game-view-builder.ts', 'packages/presenter/src/game-view-builder.ts')).toBe(true);
    expect(matchesPathPattern('packages/presenter/src/game-view-builder.ts', 'packages/presenter/src/other.ts')).toBe(false);
    expect(matchesPathPattern('packages/presenter/src/*.ts', 'packages/presenter/src/game-view-builder.ts')).toBe(true);
    expect(matchesPathPattern('packages/presenter/src/*.ts', 'packages/presenter/src/builders/map-view-builder.ts')).toBe(false);
    expect(matchesPathPattern('packages/presenter/src/builders/**', 'packages/presenter/src/builders/map-view-builder.ts')).toBe(true);
  });

  it('collects Vitest calls and test cases in source order', () => {
    const sourceFile = createSourceFile(
      'guardrail-order.test.ts',
      [
        "import { describe, expect, it, test } from 'vitest';",
        "describe('outer', () => {",
        "  test('first', () => {",
        '    expect(1).toBe(1);',
        '  });',
        "  it.skip('second', () => undefined);",
        "  test.only('third', () => undefined);",
        '});',
        '',
      ].join('\n'),
    );

    expect(collectVitestCalls(sourceFile).map(({ base, modifier }) => `${base}:${modifier ?? 'run'}`)).toEqual([
      'describe:run',
      'test:run',
      'it:skip',
      'test:only',
    ]);
    expect(collectTestCases(sourceFile).map(({ title }) => title)).toEqual(['first', 'second', 'third']);
  });
});

describe('check-feature-proofs script', () => {
  it('fails when an unstaged production gameplay file changes without proof', () => {
    const rootDir = makeTempRoot('feature-proofs-unstaged');
    seedGameplayRepo(rootDir);
    writeFixture(rootDir, 'packages/game-core/src/systems/town.ts', 'export const town = "changed";\n');

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Production feature change requires proof');
    expect(result.stderr).toContain('packages/game-core/src/systems/town.ts');
    expect(result.stderr).toContain('core gameplay runtime proof');
    expect(result.stderr).toContain('tests/integration/*.integration.test.ts');
  });

  it('passes when a matching integration proof changes in the same diff', () => {
    const rootDir = makeTempRoot('feature-proofs-valid');
    seedGameplayRepo(rootDir);
    writeFixture(rootDir, 'packages/game-core/src/systems/town.ts', 'export const town = "changed";\n');
    writeFixture(
      rootDir,
      'tests/integration/town.integration.test.ts',
      'import { it } from "vitest";\nit("proves town behavior", () => undefined);\n',
    );

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Feature proof guardrail passed');
  });

  it('detects staged, committed, and untracked production changes', () => {
    const stagedRoot = makeTempRoot('feature-proofs-staged');
    seedGameplayRepo(stagedRoot);
    writeFixture(stagedRoot, 'packages/game-core/src/systems/town.ts', 'export const town = "staged";\n');
    runGit(stagedRoot, ['add', 'packages/game-core/src/systems/town.ts']);

    const stagedResult = runFeatureProofs(stagedRoot);
    expect(stagedResult.status).toBe(1);
    expect(stagedResult.stderr).toContain('packages/game-core/src/systems/town.ts');

    const committedRoot = makeTempRoot('feature-proofs-committed');
    seedGameplayRepo(committedRoot);
    runGit(committedRoot, ['checkout', '--quiet', '-b', 'feature']);
    writeFixture(committedRoot, 'packages/game-core/src/systems/town.ts', 'export const town = "committed";\n');
    commitAll(committedRoot, 'change town');

    const committedResult = runFeatureProofs(committedRoot);
    expect(committedResult.status).toBe(1);
    expect(committedResult.stderr).toContain('packages/game-core/src/systems/town.ts');

    const untrackedRoot = makeTempRoot('feature-proofs-untracked');
    seedGameplayRepo(untrackedRoot);
    writeFixture(untrackedRoot, 'packages/game-core/src/systems/new-town-mechanic.ts', 'export const town = "new";\n');

    const untrackedResult = runFeatureProofs(untrackedRoot);
    expect(untrackedResult.status).toBe(1);
    expect(untrackedResult.stderr).toContain('packages/game-core/src/systems/new-town-mechanic.ts');
  });

  it('reports narrow refactor-only allowlists instead of requiring proof', () => {
    const rootDir = makeTempRoot('feature-proofs-allowlist');
    seedGameplayRepo(rootDir);
    writeFixture(
      rootDir,
      'packages/game-core/src/systems/town.ts',
      '// feature-proof: allow-refactor-only - rename local helper without behavior change\nexport const town = "changed";\n',
    );

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('allow-refactor-only');
    expect(result.stdout).toContain('rename local helper');
  });

  it('ignores stale allowlist comments that are not added in the current diff', () => {
    const rootDir = makeTempRoot('feature-proofs-stale-allowlist');
    seedGameplayRepo(rootDir);
    writeFixture(
      rootDir,
      'packages/game-core/src/systems/town.ts',
      '// feature-proof: allow-refactor-only - baseline refactor comment\nexport const town = "baseline";\n',
    );
    commitAll(rootDir, 'add baseline allowlist');
    writeFixture(
      rootDir,
      'packages/game-core/src/systems/town.ts',
      '// feature-proof: allow-refactor-only - baseline refactor comment\nexport const town = "behavior changed";\n',
    );

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Production feature change requires proof');
    expect(result.stderr).toContain('packages/game-core/src/systems/town.ts');
    expect(result.stdout).not.toContain('allow-refactor-only');
  });

  it('fails browser-facing component changes without component or E2E proof', () => {
    const rootDir = makeTempRoot('feature-proofs-browser');
    seedGameplayRepo(rootDir);
    writeFixture(rootDir, 'apps/web/src/components/TownPhase.tsx', 'export const TownPhase = () => "changed";\n');

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('apps/web/src/components/TownPhase.tsx');
    expect(result.stderr).toContain('web UI proof');
    expect(result.stderr).toContain('browser-facing proof');
  });

  it('fails presenter changes without presenter or browser-facing proof', () => {
    const rootDir = makeTempRoot('feature-proofs-presenter');
    seedGameplayRepo(rootDir);
    writeFixture(rootDir, 'packages/presenter/src/game-view-builder.ts', 'export const view = "changed";\n');

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('packages/presenter/src/game-view-builder.ts');
    expect(result.stderr).toContain('presenter proof');
    expect(result.stderr).toContain('browser-facing proof');
  });

  it('detects store and app paths through the shared browser-facing predicate used by CI', () => {
    expect(isBrowserFacingPath('apps/web/src/store/game-store.ts')).toBe(true);
    expect(isBrowserFacingPath('apps/web/src/App.tsx')).toBe(true);
    expect(isBrowserFacingPath('packages/game-core/src/systems/town.ts')).toBe(false);

    expect(runBrowserFacingMatcher(['apps/web/src/store/game-store.ts']).status).toBe(0);
    expect(runBrowserFacingMatcher(['apps/web/src/App.tsx']).status).toBe(0);
    expect(runBrowserFacingMatcher(['packages/game-core/src/systems/town.ts']).status).toBe(1);

    const workflow = readFileSync(TEST_VALIDATION_WORKFLOW, 'utf8');
    expect(workflow).toContain('node scripts/guardrails/browser-facing.mjs < /tmp/browser-facing-changes.txt');
    expect(workflow).not.toContain('grep -E');
  });

  it('uses registry feature ownership to improve repair guidance', () => {
    const rootDir = makeTempRoot('feature-proofs-registry-context');
    seedGameplayRepo(rootDir);
    writeFixture(
      rootDir,
      'docs/feature-proofs.yml',
      [
        'features:',
        '  - feature: town-actions',
        '    name: Town Actions',
        '    state:',
        '      files:',
        '        - packages/game-core/src/systems/town.ts',
        '    proofs:',
        '      required:',
        '        - tests/integration/town.integration.test.ts',
        '    validation:',
        '      focused:',
        '        - pnpm vitest run tests/integration/town.integration.test.ts',
        '      final:',
        '        - pnpm validate',
        '',
      ].join('\n'),
    );
    commitAll(rootDir, 'add registry');
    writeFixture(rootDir, 'packages/game-core/src/systems/town.ts', 'export const town = "changed";\n');

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Feature registry matches');
    expect(result.stderr).toContain('Town Actions');
    expect(result.stderr).toContain('tests/integration/town.integration.test.ts');
  });

  it('does not let unrelated integration proof satisfy registered feature change', () => {
    const rootDir = makeTempRoot('feature-proofs-registry-specific-miss');
    seedGameplayRepo(rootDir);
    writeCombatFeatureRegistry(rootDir);
    commitAll(rootDir, 'add combat registry');
    writeFixture(rootDir, 'packages/game-core/src/systems/combat.ts', 'export const combat = "changed";\n');
    writeFixture(
      rootDir,
      'tests/integration/unrelated-town.integration.test.ts',
      'import { it } from "vitest";\nit("proves unrelated town behavior", () => undefined);\n',
    );

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Registered feature proof requirement was not satisfied');
    expect(result.stderr).toContain('Combat resolution');
    expect(result.stderr).toContain('packages/game-core/src/systems/combat.test.ts');
    expect(result.stderr).toContain('tests/integration/unrelated-town.integration.test.ts');
    expect(result.stderr).not.toContain('core gameplay runtime proof');
  });

  it('passes when a registered feature change includes one of that feature proof patterns', () => {
    const rootDir = makeTempRoot('feature-proofs-registry-specific-hit');
    seedGameplayRepo(rootDir);
    writeCombatFeatureRegistry(rootDir);
    commitAll(rootDir, 'add combat registry');
    writeFixture(rootDir, 'packages/game-core/src/systems/combat.ts', 'export const combat = "changed";\n');
    writeFixture(
      rootDir,
      'tests/integration/combat.integration.test.ts',
      'import { it } from "vitest";\nit("proves registered combat behavior", () => undefined);\n',
    );

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Feature proof guardrail passed');
  });

  it('does not let a registry proof for a different category satisfy core gameplay proof', () => {
    const rootDir = makeTempRoot('feature-proofs-registry-category');
    seedGameplayRepo(rootDir);
    writeFixture(
      rootDir,
      'docs/feature-proofs.yml',
      [
        'features:',
        '  - feature: town-actions',
        '    name: Town Actions',
        '    state:',
        '      files:',
        '        - packages/game-core/src/systems/town.ts',
        '    proofs:',
        '      required:',
        '        - fixtures/saves/v1/town-start.json',
        '    validation:',
        '      focused:',
        '        - pnpm vitest run packages/game-core/src/systems/town.test.ts',
        '',
      ].join('\n'),
    );
    commitAll(rootDir, 'add registry');
    writeFixture(rootDir, 'packages/game-core/src/systems/town.ts', 'export const town = "changed";\n');
    writeFixture(rootDir, 'fixtures/saves/v1/town-start.json', '{}\n');

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('core gameplay runtime proof');
    expect(result.stderr).toContain('player-visible feature-chain proof');
  });

  it('requires save compatibility proof for game-state shape changes', () => {
    const rootDir = makeTempRoot('feature-proofs-game-state');
    seedGameplayRepo(rootDir);
    writeFixture(rootDir, 'packages/game-contracts/src/types/game-state.ts', 'export interface GameState { id: string; }\n');
    commitAll(rootDir, 'add game state type');
    writeFixture(
      rootDir,
      'packages/game-contracts/src/types/game-state.ts',
      'export interface GameState { id: string; schemaVersion: number; }\n',
    );

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('packages/game-contracts/src/types/game-state.ts');
    expect(result.stderr).toContain('save compatibility or migration proof');
  });

  it('requires focused Playwright intent when E2E support helpers change', () => {
    const rootDir = makeTempRoot('feature-proofs-e2e-support');
    seedGameplayRepo(rootDir);
    writeFixture(rootDir, 'tests/e2e/support/scenario-page.ts', 'export const helper = "baseline";\n');
    commitAll(rootDir, 'add e2e support');
    writeFixture(rootDir, 'tests/e2e/support/scenario-page.ts', 'export const helper = "changed";\n');

    const result = runFeatureProofs(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('E2E support changes must name the focused Playwright command');
    expect(result.stderr).toContain('tests/e2e/support/scenario-page.ts');
  });
});

describe('check-feature-proof-registry script', () => {
  it('passes a valid registry fixture', () => {
    const rootDir = makeTempRoot('feature-registry-valid');
    writeFixture(rootDir, 'src/feature.ts', 'export const feature = true;\n');
    writeFixture(rootDir, 'tests/contracts/feature.contract.test.ts', 'export const proof = true;\n');
    writeFixture(rootDir, 'fixtures/scenarios/feature-scenario.json', '{}\n');
    writeFixture(
      rootDir,
      'docs/feature-proofs.yml',
      [
        'features:',
        '  - feature: fixture-feature',
        '    name: Fixture Feature',
        '    state:',
        '      files:',
        '        - src/feature.ts',
        '    scenarioFixtures:',
        '      - feature-scenario',
        '    proofs:',
        '      required:',
        '        - tests/contracts/feature.contract.test.ts',
        '    validation:',
        '      focused:',
        '        - pnpm vitest run tests/contracts/feature.contract.test.ts',
        '      final:',
        '        - pnpm validate',
        '',
      ].join('\n'),
    );

    const result = runRegistryCheck(rootDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('validation passed');
  });

  it('fails invalid registry entries with actionable messages', () => {
    const rootDir = makeTempRoot('feature-registry-invalid');
    writeFixture(rootDir, '.agents/skills/example/SKILL.md', '# generated mirror\n');
    writeFixture(
      rootDir,
      'docs/feature-proofs.yml',
      [
        'features:',
        '  - feature: duplicate-feature',
        '    name: First Duplicate',
        '    state:',
        '      files:',
        '        - missing/source.ts',
        '        - .agents/skills/example/SKILL.md',
        '    scenarioFixtures:',
        '      - missing-scenario',
        '    proofs:',
        '      required:',
        '        - missing/proof.test.ts',
        '    validation:',
        '      focused:',
        '        - npm test',
        '  - feature: duplicate-feature',
        '    name: Second Duplicate',
        '    proofs:',
        '      required:',
        '        - missing/second-proof.test.ts',
        '',
      ].join('\n'),
    );

    const result = runRegistryCheck(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('duplicated');
    expect(result.stderr).toContain('listed path does not exist');
    expect(result.stderr).toContain('required proof file does not exist');
    expect(result.stderr).toContain('validation command must start with pnpm');
    expect(result.stderr).toContain('generated skill mirror path');
    expect(result.stderr).toContain('scenario fixture does not exist');
  });
});
