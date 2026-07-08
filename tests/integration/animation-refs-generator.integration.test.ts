/**
 * Test layer: integration
 * Behavior: Animation Refs Generator covers generateAnimationRefsIndex; emits an index for valid timing metadata; fails when timing fields are missing.
 * Proof: integrated command, service, or repository assertions verify the cross-module result.
 * Validation: pnpm vitest run tests/integration/animation-refs-generator.integration.test.ts
 */
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateAnimationRefsIndex } from '../../scripts/generators/animation-refs.js';

const FIXTURE_ROOTS: string[] = [];

function createFixtureRoot(): string {
  const rootDir = join(process.cwd(), '.test-fixtures', 'animation-refs-generator', randomUUID());
  mkdirSync(rootDir, { recursive: true });
  FIXTURE_ROOTS.push(rootDir);
  return rootDir;
}

function writeFixture(rootDir: string, relativePath: string, source: string): void {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
}

afterEach(() => {
  for (const rootDir of FIXTURE_ROOTS) {
    rmSync(rootDir, { recursive: true, force: true });
  }
  FIXTURE_ROOTS.length = 0;
});

describe('generateAnimationRefsIndex', () => {
  it('emits an index for valid timing metadata', () => {
    const rootDir = createFixtureRoot();
    writeFixture(
      rootDir,
      'packages/content/src/animation-refs/utility.ts',
      `import type { AnimationRef } from './types.js';

export const trapSpark = {
  id: 'fx.utility.trap-spark',
  category: 'utility',
  durationMs: 350,
  impactFrameMs: 175,
  recoveryMs: 175,
} as const satisfies AnimationRef;
`,
    );
    writeFixture(
      rootDir,
      'packages/content/src/animation-refs/types.ts',
      `export type AnimationCategory = 'utility';
export type AnimationId = \`fx.\${AnimationCategory}.\${string}\`;
export interface AnimationRef {
  readonly id: AnimationId;
  readonly category: AnimationCategory;
  readonly durationMs: number;
  readonly impactFrameMs: number;
  readonly recoveryMs: number;
}
`,
    );

    generateAnimationRefsIndex(rootDir);

    const indexPath = join(rootDir, 'packages/content/src/animation-refs/index.ts');
    expect(existsSync(indexPath)).toBe(true);
    expect(readFileSync(indexPath, 'utf8')).toContain('trapSpark');
  });

  it('fails when timing fields are missing', () => {
    const rootDir = createFixtureRoot();
    writeFixture(
      rootDir,
      'packages/content/src/animation-refs/impact.ts',
      `import type { AnimationRef } from './types.js';

export const forwardSlash = {
  id: 'fx.impact.forward-slash',
  category: 'impact',
  durationMs: 350,
  recoveryMs: 140,
} as const satisfies AnimationRef;
`,
    );

    expect(() => generateAnimationRefsIndex(rootDir)).toThrowError(
      'Could not parse AnimationRef export forwardSlash in impact.ts',
    );
  });
});
