/**
 * Test layer: integration
 * Behavior: repo guardrail checkers (topology, optional-import boundaries, reference/centralized
 *   literals, file-size hotspots, path validation, mutation config, and baseline grouping) flag violations and pass on compliant fixtures.
 * Proof: each checker returns the expected failure strings for bad fixtures and an empty array for
 *   good ones, driven through temp-dir repositories and direct script entry functions.
 * Validation: pnpm exec vitest run -c tests/vitest.config.ts guardrail-patterns
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkFeatureProofRegistry } from '../../scripts/check-feature-proof-registry.mjs';
import { checkFeatureProofs } from '../../scripts/check-feature-proofs.mjs';
import { groupByCategory } from '../../scripts/report-test-quality-baseline.mjs';
import { checkCriticalMutationConfig } from '../../scripts/run-critical-mutation.mjs';
import { checkCentralizedLiterals } from '../../scripts/guardrails/check-centralized-literals.mjs';
import { checkDocPaths } from '../../scripts/guardrails/check-doc-paths.mjs';
import {
  checkFileSizeHotspots,
  findRatchetViolations,
} from '../../scripts/guardrails/check-file-size-hotspots.mjs';
import { assertRepoRelativePath, isRepoRelativePath } from '../../scripts/guardrails/common.mjs';
import { checkOptionalImportBoundaries } from '../../scripts/guardrails/check-optional-import-boundaries.mjs';
import { checkReferenceLiterals } from '../../scripts/guardrails/check-reference-literals.mjs';
import { checkTestTopology } from '../../scripts/guardrails/check-test-topology.mjs';

const tempDirs: string[] = [];

function makeTempRoot(label: string): string {
  const rootDir = mkdtempSync(join(tmpdir(), `${label}-`));
  tempDirs.push(rootDir);
  return rootDir;
}

function writeFixture(rootDir: string, relativePath: string, source: string): string {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
  return absolutePath;
}

function runGit(rootDir: string, args: string[]): void {
  const result = spawnSync('git', ['-C', rootDir, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
  }
}

function initRepo(rootDir: string): void {
  runGit(rootDir, ['init', '--quiet']);
  runGit(rootDir, ['config', 'user.email', 'test@example.com']);
  runGit(rootDir, ['config', 'user.name', 'Test User']);
}

function commitAll(rootDir: string, message = 'fixture'): void {
  runGit(rootDir, ['add', '.']);
  runGit(rootDir, ['commit', '--quiet', '-m', message]);
}

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('guardrail pattern checks', () => {
  it('accepts normal repo paths and rejects absolute or parent traversal paths', () => {
    const accepted = [
      'docs/feature-proofs.yml',
      './scripts/check-feature-proofs.mjs',
      'packages/game-core/src/**/*.ts',
      'fixtures/scenarios/full-feature-e2e-test',
    ];
    const rejected = [
      '/tmp/outside.ts',
      '../outside.ts',
      'docs/../outside.ts',
      String.raw`C:\outside\file.ts`,
      String.raw`\\server\share\file.ts`,
    ];

    expect(accepted.map((path) => isRepoRelativePath(path))).toEqual([true, true, true, true]);
    expect(rejected.map((path) => isRepoRelativePath(path))).toEqual([false, false, false, false, false]);
    expect(assertRepoRelativePath('./docs/feature-proofs.yml', 'fixture path')).toBe('docs/feature-proofs.yml');
    expect(() => assertRepoRelativePath('../outside.yml', 'fixture path')).toThrow(/repo-relative path/);
  });

  it('rejects escaping feature-proof registry options before git diff inspection', () => {
    const rootDir = makeTempRoot('guardrail-feature-proof-option-traversal');

    expect(() => checkFeatureProofs({
      rootDir,
      registryPath: '../feature-proofs.yml',
    })).toThrow(/feature proof registry path must be a repo-relative path/);
  });

  it('reports escaping registry entries and scenario fixture names through registry validation', () => {
    const rootDir = makeTempRoot('guardrail-registry-entry-traversal');
    writeFixture(rootDir, 'docs/feature-proofs.yml', [
      'features:',
      '  - feature: escaping-feature',
      '    name: Escaping Feature',
      '    state:',
      '      files:',
      '        - ../outside.ts',
      '    scenarioFixtures:',
      '      - ../secret-scenario',
      '    proofs:',
      '      required:',
      '        - /tmp/outside-proof.test.ts',
      '    validation:',
      '      focused:',
      '        - pnpm validate',
      '',
    ].join('\n'));

    const failures = checkFeatureProofRegistry({ rootDir }).failures.join('\n');

    expect(failures).toContain('registry path must be a repo-relative path');
    expect(failures).toContain('required proof path must be a repo-relative path');
    expect(failures).toContain('scenario fixture name must be a repo-relative path');
  });

  it('rejects escaping standalone feature-proof registry paths before reading', () => {
    const rootDir = makeTempRoot('guardrail-registry-path-traversal');

    expect(() => checkFeatureProofRegistry({
      rootDir,
      registryPath: '../feature-proofs.yml',
    })).toThrow(/feature proof registry path must be a repo-relative path/);
  });

  it('rejects escaping critical mutation targets from stryker config before exact-target probing', async () => {
    const rootDir = makeTempRoot('guardrail-mutation-traversal');
    writeFixture(rootDir, 'stryker.config.mjs', [
      'export default {',
      "  mutate: ['../outside.ts'],",
      '  thresholds: { high: 80, low: 60, break: 50 },',
      '};',
      '',
    ].join('\n'));

    const result = await checkCriticalMutationConfig({ rootDir });
    const failures = result.failures.join('\n');

    expect(failures).toContain('Invalid critical mutation target');
    expect(failures).toContain('mutation target must be a repo-relative path');
    expect(failures).not.toContain('mutation target list resolved to zero files');
  });

  it('dedupes and sorts test-quality baseline paths per category deterministically', () => {
    const rows = [
      {
        relativePath: 'tests/z.test.ts',
        failures: [
          { title: 'weak assertion-only test' },
          { title: 'missing test intent header' },
        ],
      },
      {
        relativePath: 'tests/a.test.ts',
        failures: [
          { title: 'weak assertion-only test' },
          { title: 'weak assertion-only test' },
        ],
      },
      {
        relativePath: 'tests/clean.test.ts',
        failures: [],
      },
      {
        relativePath: 'tests/b.test.ts',
        failures: [
          { title: 'missing test intent header' },
        ],
      },
    ];
    const expected = {
      'weak assertion-only test': ['tests/a.test.ts', 'tests/z.test.ts'],
      'missing test intent header': ['tests/b.test.ts', 'tests/z.test.ts'],
    };

    expect(groupByCategory(rows)).toEqual(expected);
    expect(groupByCategory(rows)).toEqual(expected);
  });

  it('passes when root integration tests are tracked and named for their runner', () => {
    const rootDir = makeTempRoot('guardrail-topology-valid');
    initRepo(rootDir);
    writeFixture(rootDir, 'tests/integration/guardrail.integration.test.ts', 'import { it } from "vitest";\nit("runs", () => {});\n');
    commitAll(rootDir);

    expect(checkTestTopology({ rootDir })).toEqual([]);
  });

  it('allows tracked contract helper modules', () => {
    const rootDir = makeTempRoot('guardrail-topology-contract-helper');
    initRepo(rootDir);
    writeFixture(rootDir, 'tests/contracts/helpers/fixture-loaders.ts', 'export const fixture = true;\n');
    commitAll(rootDir);

    expect(checkTestTopology({ rootDir })).toEqual([]);
  });

  it('fails when local test files are ignored or untracked', () => {
    const rootDir = makeTempRoot('guardrail-topology-bad');
    initRepo(rootDir);
    writeFixture(rootDir, '.gitignore', 'tests/integration/*\n');
    writeFixture(rootDir, 'tests/integration/ignored.integration.test.ts', 'import { it } from "vitest";\nit("ignored", () => {});\n');
    writeFixture(rootDir, 'packages/core/src/untracked.test.ts', 'import { it } from "vitest";\nit("untracked", () => {});\n');
    runGit(rootDir, ['add', '.gitignore']);
    runGit(rootDir, ['commit', '--quiet', '-m', 'ignore tests']);

    const failures = checkTestTopology({ rootDir }).join('\n');

    expect(failures).toContain('ignored.integration.test.ts');
    expect(failures).toContain('untracked.test.ts');
  });

  it('ignores generated and canonical skill directories', () => {
    const rootDir = makeTempRoot('guardrail-topology-skills');
    initRepo(rootDir);
    writeFixture(rootDir, 'docs/skills/example/example.test.ts', 'skill fixture\n');
    writeFixture(rootDir, '.github/skills/example/example.test.ts', 'skill fixture\n');
    writeFixture(rootDir, '.claude/skills/example/example.test.ts', 'skill fixture\n');
    writeFixture(rootDir, '.agents/skills/example/example.test.ts', 'skill fixture\n');

    expect(checkTestTopology({ rootDir })).toEqual([]);
  });

  it('fails when an always-loaded entry statically reaches an optional backend', () => {
    const rootDir = makeTempRoot('guardrail-optional-bad');
    const config = [{
      name: 'fixture-optional',
      entryModules: ['src/entry.ts'],
      optionalRoots: ['src/optional'],
      forbiddenPackages: ['heavy-lib'],
      allowedDynamicImportRoots: ['src/optional'],
    }];
    writeFixture(rootDir, 'src/entry.ts', "import { effect } from './optional/effect.js';\nexport const run = effect;\n");
    writeFixture(rootDir, 'src/optional/effect.ts', "import 'heavy-lib';\nexport const effect = true;\n");

    expect(checkOptionalImportBoundaries({ rootDir, config }).join('\n')).toContain('static import reaches optional root');
  });

  it('allows optional backends behind dynamic imports', () => {
    const rootDir = makeTempRoot('guardrail-optional-valid');
    const config = [{
      name: 'fixture-optional',
      entryModules: ['src/entry.ts'],
      optionalRoots: ['src/optional'],
      forbiddenPackages: ['heavy-lib'],
      allowedDynamicImportRoots: ['src/optional'],
    }];
    writeFixture(rootDir, 'src/entry.ts', "export async function load() {\n  return import('./optional/effect.js');\n}\n");
    writeFixture(rootDir, 'src/optional/effect.ts', "import 'heavy-lib';\nexport const effect = true;\n");

    expect(checkOptionalImportBoundaries({ rootDir, config })).toEqual([]);
  });

  it('fails when implementation code copies a generated reference literal', () => {
    const rootDir = makeTempRoot('guardrail-reference-bad');
    const config = [{
      name: 'animation-refs',
      sourceExport: 'animationRefs',
      sourceRoots: ['content/animation-refs'],
      implementationRoots: ['src'],
      allowedDeclarationRoots: ['content/animation-refs'],
      allowedContractRoots: ['tests/contracts'],
      allowedFixtureRoots: ['tests/integration'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      literalPattern: /\bfx\.self\.[A-Za-z0-9._-]+\b/g,
    }];
    writeFixture(rootDir, 'content/animation-refs/self.ts', "export const healingPulse = { id: 'fx.self.healing-pulse' };\n");
    writeFixture(rootDir, 'src/effect.ts', "export const copied = 'fx.self.healing-pulse';\n");

    expect(checkReferenceLiterals({ rootDir, config }).join('\n')).toContain('copies animation-refs literal');
  });

  it('allows implementation code to use source-of-truth references', () => {
    const rootDir = makeTempRoot('guardrail-reference-valid');
    const config = [{
      name: 'animation-refs',
      sourceExport: 'animationRefs',
      sourceRoots: ['content/animation-refs'],
      implementationRoots: ['src'],
      allowedDeclarationRoots: ['content/animation-refs'],
      allowedContractRoots: ['tests/contracts'],
      allowedFixtureRoots: ['tests/integration'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      literalPattern: /\bfx\.self\.[A-Za-z0-9._-]+\b/g,
    }];
    writeFixture(rootDir, 'content/animation-refs/self.ts', "export const healingPulse = { id: 'fx.self.healing-pulse' };\n");
    writeFixture(rootDir, 'src/effect.ts', "import { animationRefs } from '../content/animation-refs/index.js';\nexport const id = animationRefs.self.healingPulse.id;\n");

    expect(checkReferenceLiterals({ rootDir, config })).toEqual([]);
  });

  it('fails when implementation code copies a status reference literal', () => {
    const rootDir = makeTempRoot('guardrail-status-reference-bad');
    const config = [{
      name: 'status-refs',
      sourceExport: 'the named status definition',
      sourceRoots: ['content/statuses'],
      implementationRoots: ['src'],
      allowedDeclarationRoots: ['content/statuses'],
      allowedContractRoots: ['tests/contracts'],
      allowedFixtureRoots: ['tests/integration'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      sourcePattern: /\bid:\s*['"](?<value>[a-z_]+)['"]/g,
      implementationPattern: /\bstatusId\s*(?::|===)\s*['"](?<value>[a-z_]+)['"]/g,
    }];
    writeFixture(rootDir, 'content/statuses/burn.ts', "export const burn = { id: 'burn' };\n");
    writeFixture(rootDir, 'src/effect.ts', "export const effect = { statusId: 'burn' };\n");

    expect(checkReferenceLiterals({ rootDir, config }).join('\n')).toContain('copies status-refs literal "burn"');
  });

  it('fails when implementation code compares ids against a status literal', () => {
    const rootDir = makeTempRoot('guardrail-status-comparison-bad');
    const config = [{
      name: 'status-refs',
      sourceExport: 'the named status definition',
      sourceRoots: ['content/statuses'],
      implementationRoots: ['src'],
      allowedDeclarationRoots: ['content/statuses'],
      allowedContractRoots: ['tests/contracts'],
      allowedFixtureRoots: ['tests/integration'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      sourcePattern: /\bid:\s*['"](?<value>[a-z_]+)['"]/g,
      implementationPattern: /\b(?:statusId\s*(?::|===)|id\s*[!=]==)\s*['"](?<value>[a-z_]+)['"]/g,
    }];
    writeFixture(rootDir, 'content/statuses/stun.ts', "export const stun = { id: 'stun' };\n");
    writeFixture(rootDir, 'src/scheduler.ts', "export const isStunned = (s: { id: string }) => s.id === 'stun';\n");

    expect(checkReferenceLiterals({ rootDir, config }).join('\n')).toContain('copies status-refs literal "stun"');
  });

  it('allows implementation code to dot-walk imported status refs', () => {
    const rootDir = makeTempRoot('guardrail-status-reference-valid');
    const config = [{
      name: 'status-refs',
      sourceExport: 'the named status definition',
      sourceRoots: ['content/statuses'],
      implementationRoots: ['src'],
      allowedDeclarationRoots: ['content/statuses'],
      allowedContractRoots: ['tests/contracts'],
      allowedFixtureRoots: ['tests/integration'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      sourcePattern: /\bid:\s*['"](?<value>[a-z_]+)['"]/g,
      implementationPattern: /\bstatusId\s*(?::|===)\s*['"](?<value>[a-z_]+)['"]/g,
    }];
    writeFixture(rootDir, 'content/statuses/burn.ts', "export const burn = { id: 'burn' };\n");
    writeFixture(rootDir, 'src/effect.ts', "import { burn } from '../content/statuses/index.js';\nexport const effect = { statusId: burn.id };\n");

    expect(checkReferenceLiterals({ rootDir, config })).toEqual([]);
  });

  it('fails when game-core code builds a factory-owned domain event inline', () => {
    const rootDir = makeTempRoot('guardrail-event-literal-bad');
    const config = [{
      name: 'domain-event-factories',
      ownerModule: 'src/emit-events.ts',
      protectedSurfaces: ['src'],
      allowedFiles: ['src/emit-events.ts'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      literals: [{
        exportName: 'STATUS_APPLIED',
        patterns: [/\btype:\s*['"]STATUS_APPLIED['"]/g],
        failureMessage: 'builds STATUS_APPLIED inline; use the domain-event-factories factory in src/emit-events.ts',
      }],
    }];
    writeFixture(
      rootDir,
      'src/handler.ts',
      "export const event = { type: 'STATUS_APPLIED', targetId: 'enemy', duration: 3 };\n",
    );

    const failures = checkCentralizedLiterals({ rootDir, config }).join('\n');

    expect(failures).toContain('src/handler.ts');
    expect(failures).toContain('builds STATUS_APPLIED inline');
  });

  it('allows the factory module and tests to construct domain events', () => {
    const rootDir = makeTempRoot('guardrail-event-literal-valid');
    const config = [{
      name: 'domain-event-factories',
      ownerModule: 'src/emit-events.ts',
      protectedSurfaces: ['src'],
      allowedFiles: ['src/emit-events.ts'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      literals: [{
        exportName: 'STATUS_APPLIED',
        patterns: [/\btype:\s*['"]STATUS_APPLIED['"]/g],
        failureMessage: 'builds STATUS_APPLIED inline; use the domain-event-factories factory in src/emit-events.ts',
      }],
    }];
    writeFixture(
      rootDir,
      'src/emit-events.ts',
      "export function buildStatusAppliedEvent() { return { type: 'STATUS_APPLIED' }; }\n",
    );
    writeFixture(
      rootDir,
      'src/handler.test.ts',
      "export const expected = { type: 'STATUS_APPLIED' };\n",
    );
    writeFixture(
      rootDir,
      'src/handler.ts',
      "import { buildStatusAppliedEvent } from './emit-events.js';\nexport const event = buildStatusAppliedEvent();\n",
    );

    expect(checkCentralizedLiterals({ rootDir, config })).toEqual([]);
  });

  it('fails when content relationship code copies an enemy template literal', () => {
    const rootDir = makeTempRoot('guardrail-enemy-template-bad');
    const config = [{
      name: 'enemy-template-refs',
      sourceExport: 'the named enemy template',
      sourceRoots: ['content/enemies'],
      implementationRoots: ['content/factions'],
      allowedDeclarationRoots: ['content/enemies'],
      allowedContractRoots: ['tests/contracts'],
      allowedFixtureRoots: ['tests/integration'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      sourcePattern: /\btemplateId:\s*['"](?<value>[a-z_]+)['"]/g,
      implementationPattern: /\btemplateId:\s*['"](?<value>[a-z_]+)['"]/g,
    }];
    writeFixture(rootDir, 'content/enemies/goblin-warlord.ts', "export const goblinWarlord = { templateId: 'goblin_warlord' };\n");
    writeFixture(rootDir, 'content/factions/goblin-warband.ts', "export const goblinWarband = { leader: { templateId: 'goblin_warlord' } };\n");

    expect(checkReferenceLiterals({ rootDir, config }).join('\n')).toContain('copies enemy-template-refs literal "goblin_warlord"');
  });

  it('allows content relationship code to dot-walk imported enemy template refs', () => {
    const rootDir = makeTempRoot('guardrail-enemy-template-valid');
    const config = [{
      name: 'enemy-template-refs',
      sourceExport: 'the named enemy template',
      sourceRoots: ['content/enemies'],
      implementationRoots: ['content/factions'],
      allowedDeclarationRoots: ['content/enemies'],
      allowedContractRoots: ['tests/contracts'],
      allowedFixtureRoots: ['tests/integration'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      sourcePattern: /\btemplateId:\s*['"](?<value>[a-z_]+)['"]/g,
      implementationPattern: /\btemplateId:\s*['"](?<value>[a-z_]+)['"]/g,
    }];
    writeFixture(rootDir, 'content/enemies/goblin-warlord.ts', "export const goblinWarlord = { templateId: 'goblin_warlord' };\n");
    writeFixture(rootDir, 'content/factions/goblin-warband.ts', "import { goblinWarlord } from '../enemies/index.js';\nexport const goblinWarband = { leader: { templateId: goblinWarlord.templateId } };\n");

    expect(checkReferenceLiterals({ rootDir, config })).toEqual([]);
  });

  it('fails when content relationship code copies a ring item literal', () => {
    const rootDir = makeTempRoot('guardrail-ring-item-bad');
    const config = [{
      name: 'ring-item-refs',
      sourceExport: 'the named ring item definition',
      sourceRoots: ['content/items'],
      implementationRoots: ['content/ring-schools'],
      allowedDeclarationRoots: ['content/items'],
      allowedContractRoots: ['tests/contracts'],
      allowedFixtureRoots: ['tests/integration'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      sourcePattern: /\bitemId:\s*['"](?<value>[a-z_]+)['"]/g,
      implementationPattern: /\bringId:\s*['"](?<value>[a-z_]+)['"]/g,
    }];
    writeFixture(rootDir, 'content/items/fire-ring.ts', "export const fireRing = { itemId: 'fire_ring' };\n");
    writeFixture(rootDir, 'content/ring-schools/fire.ts', "export const fire = { ringId: 'fire_ring' };\n");

    expect(checkReferenceLiterals({ rootDir, config }).join('\n')).toContain('copies ring-item-refs literal "fire_ring"');
  });

  it('allows content relationship code to dot-walk imported ring item refs', () => {
    const rootDir = makeTempRoot('guardrail-ring-item-valid');
    const config = [{
      name: 'ring-item-refs',
      sourceExport: 'the named ring item definition',
      sourceRoots: ['content/items'],
      implementationRoots: ['content/ring-schools'],
      allowedDeclarationRoots: ['content/items'],
      allowedContractRoots: ['tests/contracts'],
      allowedFixtureRoots: ['tests/integration'],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      sourcePattern: /\bitemId:\s*['"](?<value>[a-z_]+)['"]/g,
      implementationPattern: /\bringId:\s*['"](?<value>[a-z_]+)['"]/g,
    }];
    writeFixture(rootDir, 'content/items/fire-ring.ts', "export const fireRing = { itemId: 'fire_ring' };\n");
    writeFixture(rootDir, 'content/ring-schools/fire.ts', "import { fireRing } from '../items/index.js';\nexport const fire = { ringId: fireRing.itemId };\n");

    expect(checkReferenceLiterals({ rootDir, config })).toEqual([]);
  });

  it('fails when docs point to missing repo paths', () => {
    const rootDir = makeTempRoot('guardrail-docs-bad');
    const config = { roots: ['docs'], allowedInlinePrefixes: [], allowedInlinePatterns: [] };
    writeFixture(rootDir, 'docs/guide.md', 'See [Missing](missing.md) and `docs/missing.md`.\n');

    expect(checkDocPaths({ rootDir, config }).join('\n')).toContain('missing path');
  });

  it('allows docs paths that resolve and ignores command-like inline examples', () => {
    const rootDir = makeTempRoot('guardrail-docs-valid');
    const config = {
      roots: ['docs'],
      allowedInlinePrefixes: ['pnpm ', '@', 'VITE_'],
      allowedInlinePatterns: [/[*{}<>]/],
    };
    writeFixture(rootDir, 'docs/guide.md', [
      'See [Real](real.md).',
      'Run `pnpm validate` with `VITE_THREE_EFFECTS=true`.',
      'Template path `src/{new-file}.ts` is an example.',
    ].join('\n'));
    writeFixture(rootDir, 'docs/real.md', '# Real\n');

    expect(checkDocPaths({ rootDir, config })).toEqual([]);
  });

  it('fails when configured surfaces duplicate centralized literals', () => {
    const rootDir = makeTempRoot('guardrail-central-bad');
    const config = [{
      name: 'fixture-ui',
      ownerModule: 'src/config.ts',
      protectedSurfaces: ['src/components'],
      allowedFilePatterns: [/\.test\.ts$/],
      literals: [{ exportName: 'MIN_WIDTH', patterns: [/\buseState\s*\(\s*15\s*\)/] }],
    }];
    writeFixture(rootDir, 'src/components/View.tsx', "import { useState } from 'react';\nexport function View() { return useState(15)[0]; }\n");

    expect(checkCentralizedLiterals({ rootDir, config }).join('\n')).toContain('duplicates fixture-ui');
  });

  it('allows configured surfaces that import centralized constants', () => {
    const rootDir = makeTempRoot('guardrail-central-valid');
    const config = [{
      name: 'fixture-ui',
      ownerModule: 'src/config.ts',
      protectedSurfaces: ['src/components'],
      allowedFilePatterns: [/\.test\.ts$/],
      literals: [{ exportName: 'MIN_WIDTH', patterns: [/\buseState\s*\(\s*15\s*\)/] }],
    }];
    writeFixture(rootDir, 'src/components/View.tsx', "import { useState } from 'react';\nimport { MIN_WIDTH } from '../config.js';\nexport function View() { return useState(MIN_WIDTH)[0]; }\n");

    expect(checkCentralizedLiterals({ rootDir, config })).toEqual([]);
  });

  it('fails when web components interpret ability IDs instead of view metadata', () => {
    const rootDir = makeTempRoot('guardrail-web-ability-id-bad');
    const config = [{
      name: 'web-ability-id-interpretation',
      ownerModule: 'packages/presenter/src/builders/player-ability-view-builder.ts',
      protectedSurfaces: ['apps/web/src'],
      allowedFiles: [],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      literals: [{
        exportName: 'AbilityView.tileTarget / AbilityView.trapInteraction',
        patterns: [/['"]thunder_step['"]/, /['"]dagger_set_trap['"]/, /['"]dagger_disarm['"]/],
      }],
    }];
    writeFixture(
      rootDir,
      'apps/web/src/components/View.tsx',
      "export const isThunderStep = (abilityId: string) => abilityId === 'thunder_step';\n",
    );

    const failures = checkCentralizedLiterals({ rootDir, config }).join('\n');

    expect(failures).toContain('apps/web/src/components/View.tsx');
    expect(failures).toContain('duplicates web-ability-id-interpretation');
  });

  it('allows web tests to reference ability IDs as fixtures', () => {
    const rootDir = makeTempRoot('guardrail-web-ability-id-valid');
    const config = [{
      name: 'web-ability-id-interpretation',
      ownerModule: 'packages/presenter/src/builders/player-ability-view-builder.ts',
      protectedSurfaces: ['apps/web/src'],
      allowedFiles: [],
      allowedFilePatterns: [/\.test\.[tj]sx?$/],
      literals: [{
        exportName: 'AbilityView.tileTarget / AbilityView.trapInteraction',
        patterns: [/['"]thunder_step['"]/, /['"]dagger_set_trap['"]/, /['"]dagger_disarm['"]/],
      }],
    }];
    writeFixture(
      rootDir,
      'apps/web/src/components/View.test.tsx',
      "export const fixtureAbilityId = 'dagger_set_trap';\n",
    );
    writeFixture(
      rootDir,
      'apps/web/src/components/View.tsx',
      "export const usesMetadata = (ability: { tileTarget?: boolean }) => ability.tileTarget === true;\n",
    );

    expect(checkCentralizedLiterals({ rootDir, config })).toEqual([]);
  });

  it('reports a ratchet violation when an allowlist pin increases from base', () => {
    const violations = findRatchetViolations(
      [{ path: 'src/hotspot.ts', reason: 'Existing hotspot', lines: 600 }],
      [{ path: 'src/hotspot.ts', reason: 'Existing hotspot', lines: 500 }],
      500,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("pinned line budget for 'src/hotspot.ts' increased from 500 to 600");
  });

  it('allows a ratcheted allowlist pin to decrease from base', () => {
    expect(findRatchetViolations(
      [{ path: 'src/hotspot.ts', reason: 'Existing hotspot', lines: 500 }],
      [{ path: 'src/hotspot.ts', reason: 'Existing hotspot', lines: 600 }],
      500,
    )).toEqual([]);
  });

  it('allows an allowlist pin for an entry absent at base', () => {
    expect(findRatchetViolations(
      [{ path: 'src/new-hotspot.ts', reason: 'New hotspot', lines: 600 }],
      [{ path: 'src/old-hotspot.ts', reason: 'Existing hotspot', lines: 500 }],
      500,
    )).toEqual([]);
  });

  it('allows an allowlist pin that is equal to base', () => {
    expect(findRatchetViolations(
      [{ path: 'src/hotspot.ts', reason: 'Existing hotspot', lines: 500 }],
      [{ path: 'src/hotspot.ts', reason: 'Existing hotspot', lines: 500 }],
      500,
    )).toEqual([]);
  });

  it('fails closed when the file-size ratchet base ref cannot be resolved', () => {
    const rootDir = makeTempRoot('guardrail-ratchet-missing-base');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /dist\//],
      allowlistedFiles: [
        {
          path: 'packages/game-core/src/hotspot.ts',
          reason: 'Existing hotspot under active refactor',
          lines: 600,
        },
      ],
    };
    const lines = Array.from({ length: 600 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/game-core/src/hotspot.ts', lines);
    initRepo(rootDir);
    commitAll(rootDir);

    const failures = checkFileSizeHotspots({
      rootDir,
      config,
      baseRef: 'missing-file-size-base',
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('Cannot verify file-size ratchet');
    expect(failures[0]).toContain('base ref "missing-file-size-base" (or "origin/missing-file-size-base") is not available');
    expect(failures[0]).toContain('git fetch origin missing-file-size-base');
  });

  it('allows first file-size ratchet adoption when the config is absent at a resolved base ref', () => {
    const rootDir = makeTempRoot('guardrail-ratchet-new-config');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /dist\//],
      allowlistedFiles: [
        {
          path: 'packages/game-core/src/hotspot.ts',
          reason: 'Existing hotspot under active refactor',
          lines: 600,
        },
      ],
    };
    const lines = Array.from({ length: 600 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/game-core/src/hotspot.ts', lines);
    initRepo(rootDir);
    commitAll(rootDir);

    expect(checkFileSizeHotspots({ rootDir, config, baseRef: 'HEAD' })).toEqual([]);
  });

  it('rejects file-size config paths that escape the repo before ratchet git lookup', () => {
    const rootDir = makeTempRoot('guardrail-ratchet-escaping-config');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /dist\//],
      allowlistedFiles: [
        {
          path: 'packages/game-core/src/hotspot.ts',
          reason: 'Existing hotspot under active refactor',
          lines: 600,
        },
      ],
    };
    const lines = Array.from({ length: 600 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/game-core/src/hotspot.ts', lines);

    const failures = checkFileSizeHotspots({
      rootDir,
      config,
      baseRef: 'missing-file-size-base',
      configRelativePath: join(rootDir, '..', 'outside-config.mjs'),
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('config path');
    expect(failures[0]).toContain('resolves outside repository root');
    expect(failures.join('\n')).not.toContain('base ref "missing-file-size-base"');
  });

  it('rejects file-size allowlist entries and included roots that escape the repo', () => {
    const rootDir = makeTempRoot('guardrail-file-size-entry-traversal');
    const baseConfig = {
      maxLinesPerFile: 500,
      includedRoots: [],
      excludePatterns: [],
      allowlistedFiles: [],
    };
    writeFixture(rootDir, 'README.md', '# fixture\n');
    initRepo(rootDir);
    commitAll(rootDir);

    const allowlistFailures = checkFileSizeHotspots({
      rootDir,
      baseRef: 'HEAD',
      config: {
        ...baseConfig,
        allowlistedFiles: [{
          path: '../outside.ts',
          reason: 'Escaping fixture',
          lines: 600,
        }],
      },
    }).join('\n');
    const includedRootFailures = checkFileSizeHotspots({
      rootDir,
      config: {
        ...baseConfig,
        includedRoots: ['../outside'],
      },
    }).join('\n');

    expect(allowlistFailures).toContain('file-size allowlist path must be a repo-relative path');
    expect(includedRootFailures).toContain('file-size included root must be a repo-relative path');
  });

  it('fails when a manually maintained source file exceeds the line budget without allowlist entry', () => {
    const rootDir = makeTempRoot('guardrail-file-size-bad');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [],
    };
    // Create a fixture file with 550 lines (exceeds 500-line budget)
    const lines = Array.from({ length: 550 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/game-core/src/oversized-handler.ts', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('exceeds 500-line budget');
    expect(failures.join('\n')).toContain('oversized-handler.ts');
  });

  it('allows manually maintained source files within the line budget', () => {
    const rootDir = makeTempRoot('guardrail-file-size-valid-small');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [],
    };
    // Create a fixture file with 450 lines (within 500-line budget)
    const lines = Array.from({ length: 450 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/game-core/src/normal-handler.ts', lines);

    expect(checkFileSizeHotspots({ rootDir, config })).toEqual([]);
  });

  it('allows oversized files that are in the allowlist with rationale', () => {
    const rootDir = makeTempRoot('guardrail-file-size-valid-allowlisted');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [
        {
          path: 'packages/game-core/src/critical-handler.ts',
          reason: 'Critical mixed-responsibility handler — marked for refactoring',
          lines: 590,
        },
      ],
    };
    // Create a fixture file with 590 lines (exceeds budget but is allowlisted)
    const lines = Array.from({ length: 590 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/game-core/src/critical-handler.ts', lines);
    initRepo(rootDir);
    commitAll(rootDir);

    expect(checkFileSizeHotspots({ rootDir, config, baseRef: 'HEAD' })).toEqual([]);
  });

  it('excludes test files from the line budget check', () => {
    const rootDir = makeTempRoot('guardrail-file-size-valid-tests');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [],
    };
    // Create a test file with 1000 lines (should be excluded regardless of size)
    const lines = Array.from({ length: 1000 }, (_, i) => `it('test ${i}', () => {});`).join('\n');
    writeFixture(rootDir, 'packages/game-core/src/handler.test.ts', lines);

    expect(checkFileSizeHotspots({ rootDir, config })).toEqual([]);
  });

  it('excludes generated files from the line budget check', () => {
    const rootDir = makeTempRoot('guardrail-file-size-valid-generated');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/content/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [],
    };
    // Create a generated file with 6000 lines (should be excluded by -raw.ts pattern)
    const lines = Array.from({ length: 6000 }, (_, i) => `const entry${i} = { id: ${i} };`).join('\n');
    writeFixture(rootDir, 'packages/content/src/sprites/atlas-raw.ts', lines);

    expect(checkFileSizeHotspots({ rootDir, config })).toEqual([]);
  });

  it('checks packages outside the originally enumerated set when using dynamic discovery', () => {
    const rootDir = makeTempRoot('guardrail-file-size-dynamic-discovery');
    const config = {
      maxLinesPerFile: 500,
      // Simulate dynamic discovery by including a package not in the original hardcoded list
      includedRoots: ['packages/eslint-plugin/src', 'packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [],
    };
    // Create an oversized file in a newly discovered package
    const lines = Array.from({ length: 550 }, (_, i) => `const rule${i} = { name: "rule-${i}" };`).join('\n');
    writeFixture(rootDir, 'packages/eslint-plugin/src/index.ts', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('packages/eslint-plugin/src/index.ts');
    expect(failures.join('\n')).toContain('exceeds 500-line budget');
  });

  it('allows oversized packages when they are in the allowlist with audit rationale', () => {
    const rootDir = makeTempRoot('guardrail-file-size-dynamic-allowlist');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/eslint-plugin/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [
        {
          path: 'packages/eslint-plugin/src/index.ts',
          reason: 'Monolithic custom ESLint plugin — single entry point for multiple rule definitions',
          auditReportNote: 'Tooling package; split requires breaking plugin interface',
          lines: 919,
        },
      ],
    };
    // Create a file with 919 lines (exceeds budget but is allowlisted)
    const lines = Array.from({ length: 919 }, (_, i) => `const rule${i} = { name: "rule-${i}" };`).join('\n');
    writeFixture(rootDir, 'packages/eslint-plugin/src/index.ts', lines);
    initRepo(rootDir);
    commitAll(rootDir);

    expect(checkFileSizeHotspots({ rootDir, config, baseRef: 'HEAD' })).toEqual([]);
  });

  it('auto-discovers packages outside explicit enumeration when includedRoots is not provided', () => {
    const rootDir = makeTempRoot('guardrail-file-size-auto-discovery');
    const config = {
      maxLinesPerFile: 500,
      // Omit includedRoots to trigger auto-discovery
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [],
    };
    // Create an oversized file in a newly discovered package (not in hardcoded enumeration)
    const lines = Array.from({ length: 550 }, (_, i) => `const module${i} = { id: "mod-${i}" };`).join('\n');
    writeFixture(rootDir, 'packages/custom-new-lib/src/helpers.ts', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('packages/custom-new-lib/src/helpers.ts');
    expect(failures.join('\n')).toContain('exceeds 500-line budget');
  });

  it('auto-discovers scripts directory when includedRoots is not provided', () => {
    const rootDir = makeTempRoot('guardrail-file-size-scripts-discovery');
    const config = {
      maxLinesPerFile: 500,
      // Omit includedRoots to trigger auto-discovery
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [],
    };
    // Create an oversized file in scripts
    const lines = Array.from({ length: 550 }, (_, i) => `const check${i} = () => {};`).join('\n');
    writeFixture(rootDir, 'scripts/build/custom-builder.ts', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('scripts/build/custom-builder.ts');
    expect(failures.join('\n')).toContain('exceeds 500-line budget');
  });

  it('rejects allowlist entries for files that are below the line budget', () => {
    const rootDir = makeTempRoot('guardrail-allowlist-below-budget');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [
        {
          path: 'packages/game-core/src/small-handler.ts',
          reason: 'This file is actually small and should not be allowlisted',
          lines: 300, // Below the 500-line budget
        },
      ],
    };
    // Create a file with only 300 lines (below budget)
    const lines = Array.from({ length: 300 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/game-core/src/small-handler.ts', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('small-handler.ts');
    expect(failures.join('\n')).toContain('below the 500-line budget');
  });

  it('rejects allowlist entries for files that are excluded by excludePatterns', () => {
    const rootDir = makeTempRoot('guardrail-allowlist-excluded');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/content/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [
        {
          path: 'packages/content/src/sprites/atlas-data-raw.ts',
          reason: 'Generated file that should not be in allowlist',
          lines: 5000,
        },
      ],
    };
    // Create a generated file with 5000 lines that matches the excluded pattern
    const lines = Array.from({ length: 5000 }, (_, i) => `const entry${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/content/src/sprites/atlas-data-raw.ts', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('atlas-data-raw.ts');
    expect(failures.join('\n')).toContain('is excluded by excludePatterns');
  });

  it('rejects allowlist entries with missing reason', () => {
    const rootDir = makeTempRoot('guardrail-allowlist-no-reason');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [
        {
          path: 'packages/game-core/src/undocumented-handler.ts',
          reason: '',
          lines: 600,
        },
      ],
    };
    // Create an oversized file with an empty reason
    const lines = Array.from({ length: 600 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/game-core/src/undocumented-handler.ts', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('undocumented-handler.ts');
    expect(failures.join('\n')).toContain('has an empty reason');
  });

  it('rejects allowlist entries for files that do not exist', () => {
    const rootDir = makeTempRoot('guardrail-allowlist-nonexistent');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/game-core/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [
        {
          path: 'packages/game-core/src/missing-handler.ts',
          reason: 'This file no longer exists',
          lines: 600,
        },
      ],
    };
    // Don't create the file — it should be detected as missing

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('missing-handler.ts');
    expect(failures.join('\n')).toContain('does not exist');
  });

  it('rejects allowlist entries with stale lines metadata (declared vs actual mismatch)', () => {
    const rootDir = makeTempRoot('guardrail-allowlist-stale-lines');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['packages/presenter/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [
        {
          path: 'packages/presenter/src/game-view.ts',
          reason: 'Central DTO/read-model contract surface',
          lines: 570, // Stale: actual file has 571 lines
        },
      ],
    };
    // Create a file with 571 lines (mismatches the declared 570)
    const lines = Array.from({ length: 571 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/presenter/src/game-view.ts', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('game-view.ts');
    expect(failures.join('\n')).toContain('stale lines metadata');
    expect(failures.join('\n')).toContain('declared 570');
    expect(failures.join('\n')).toContain('actual 571');
  });

  it('allows line-count drift within linesTolerancePercent without re-pinning', () => {
    const rootDir = makeTempRoot('guardrail-allowlist-within-tolerance');
    const config = {
      maxLinesPerFile: 500,
      linesTolerancePercent: 5,
      includedRoots: ['packages/presenter/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [
        {
          path: 'packages/presenter/src/game-view.ts',
          reason: 'Central DTO/read-model contract surface',
          lines: 570, // 5% tolerance allows up to ceil(570 * 5%) = 29 lines of drift
        },
      ],
    };
    // Actual 595 lines: drift of 25 is within the ceil(570 * 5%) = 29 allowance
    const lines = Array.from({ length: 595 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/presenter/src/game-view.ts', lines);
    initRepo(rootDir);
    commitAll(rootDir);

    expect(checkFileSizeHotspots({ rootDir, config, baseRef: 'HEAD' })).toEqual([]);
  });

  it('still flags line-count drift beyond linesTolerancePercent', () => {
    const rootDir = makeTempRoot('guardrail-allowlist-beyond-tolerance');
    const config = {
      maxLinesPerFile: 500,
      linesTolerancePercent: 5,
      includedRoots: ['packages/presenter/src'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [
        {
          path: 'packages/presenter/src/game-view.ts',
          reason: 'Central DTO/read-model contract surface',
          lines: 570,
        },
      ],
    };
    // Actual 620 lines: drift of 50 exceeds the ceil(570 * 5%) = 29 allowance
    const lines = Array.from({ length: 620 }, (_, i) => `const line${i} = ${i};`).join('\n');
    writeFixture(rootDir, 'packages/presenter/src/game-view.ts', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('stale lines metadata');
    expect(failures.join('\n')).toContain('declared 570');
    expect(failures.join('\n')).toContain('actual 620');
  });

  it('flags oversized .mjs guardrail scripts when scripts directory is included', () => {
    const rootDir = makeTempRoot('guardrail-file-size-mjs-scripts');
    const config = {
      maxLinesPerFile: 500,
      includedRoots: ['scripts'],
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [],
    };
    // Create an oversized .mjs guardrail script (550 lines, exceeds 500-line budget)
    const lines = Array.from({ length: 550 }, (_, i) => `const check${i} = () => { return ${i}; };`).join('\n');
    writeFixture(rootDir, 'scripts/guardrails/custom-checker.mjs', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('custom-checker.mjs');
    expect(failures.join('\n')).toContain('exceeds 500-line budget');
  });

  it('flags oversized .mjs scripts during auto-discovery when includedRoots is omitted', () => {
    const rootDir = makeTempRoot('guardrail-file-size-mjs-autodiscover');
    const config = {
      maxLinesPerFile: 500,
      // Omit includedRoots to trigger auto-discovery, which should discover scripts
      excludePatterns: [/\.test\.[tj]sx?$/, /\.property\.test\.[tj]sx?$/, /\.balance\.test\.[tj]sx?$/, /\.integration\.test\.[tj]sx?$/, /\.contract\.test\.[tj]sx?$/, /generated/, /-raw\.ts$/, /dist\//, /node_modules\//],
      allowlistedFiles: [],
    };
    // Create an oversized .mjs guardrail script (550 lines, exceeds 500-line budget)
    const lines = Array.from({ length: 550 }, (_, i) => `const validate${i} = () => { return true; };`).join('\n');
    writeFixture(rootDir, 'scripts/guardrails/oversized-validator.mjs', lines);

    const failures = checkFileSizeHotspots({ rootDir, config });

    expect(failures.join('\n')).toContain('oversized-validator.mjs');
    expect(failures.join('\n')).toContain('exceeds 500-line budget');
  });

  it('validates thunder-step handler uses advanceTurnAfterPlayerAction', () => {
    const handlersDir = join(process.cwd(), 'packages/game-core/src/engine/handlers');
    const thunderStepPath = join(handlersDir, 'thunder-step.ts');
    const content = readFileSync(thunderStepPath, 'utf-8');

    // Must NOT import turn advance functions directly
    const forbiddenImports = ['applyActiveTurnManaRegen', 'processEnemyTurns', 'tickAbilityCooldowns'];
    const violations: string[] = [];
    for (const forbidden of forbiddenImports) {
      if (content.includes(forbidden)) {
        violations.push(`thunder-step imports ${forbidden}`);
      }
    }
    expect(violations, 'thunder-step must use advanceTurnAfterPlayerAction instead').toEqual([]);

    // Must import advanceTurnAfterPlayerAction from turn-advance-pipeline
    expect(content).toMatch(
      /import\s+{[^}]*advanceTurnAfterPlayerAction[^}]*}\s+from\s+['"]\.\.\/turn-advance-pipeline\.js['"]/
    );

    // Must call advanceTurnAfterPlayerAction with newState, events, rng
    expect(content).toMatch(/advanceTurnAfterPlayerAction\s*\(\s*newState\s*,\s*events\s*,\s*rng\s*\)/);
  });
});
