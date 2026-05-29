import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkCentralizedLiterals } from '../../scripts/guardrails/check-centralized-literals.mjs';
import { checkDocPaths } from '../../scripts/guardrails/check-doc-paths.mjs';
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
  it('passes when root integration tests are tracked and named for their runner', () => {
    const rootDir = makeTempRoot('guardrail-topology-valid');
    initRepo(rootDir);
    writeFixture(rootDir, 'tests/integration/guardrail.integration.test.ts', 'import { it } from "vitest";\nit("runs", () => {});\n');
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
});
