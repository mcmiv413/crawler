/**
 * Test layer: integration
 * Behavior: The workspace wiring checker accepts declared exported workspace imports and rejects src internals, undeclared packages, and unexported subpaths.
 * Proof: Assertions check exit status 0 with the pass message and exit status 1 diagnostics for @dungeon/presenter/src/targeting/index.js, missing @dungeon/presenter dependency declaration, and missing ./targeting export.
 * Validation: pnpm vitest run tests/integration/workspace-wiring.integration.test.ts
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(new URL('../../scripts/check-workspace-wiring.mjs', import.meta.url));

function writeFixture(rootDir: string, relativePath: string, source: string): void {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
}

function writeJsonFixture(rootDir: string, relativePath: string, value: unknown): void {
  writeFixture(rootDir, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function runWorkspaceWiring(rootDir: string) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

function createTargetPackage(rootDir: string, exportsMap: Record<string, unknown>): void {
  writeJsonFixture(rootDir, 'packages/presenter/package.json', {
    name: '@dungeon/presenter',
    private: true,
    type: 'module',
    exports: exportsMap,
  });
}

function createConsumerPackage(
  rootDir: string,
  dependencies: Record<string, string>,
  source: string,
): void {
  writeJsonFixture(rootDir, 'apps/web/package.json', {
    name: '@dungeon/web',
    private: true,
    type: 'module',
    dependencies,
  });
  writeFixture(rootDir, 'apps/web/src/main.ts', source);
}

describe('check-workspace-wiring script', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('passes for declared workspace imports that use exported subpaths', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'workspace-wiring-'));
    tempDirs.push(rootDir);

    createTargetPackage(rootDir, {
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
      './targeting': {
        types: './dist/targeting/index.d.ts',
        default: './dist/targeting/index.js',
      },
    });
    createConsumerPackage(
      rootDir,
      { '@dungeon/presenter': 'workspace:*' },
      "import { getTargeting } from '@dungeon/presenter/targeting';\nvoid getTargeting;\n",
    );

    const result = runWorkspaceWiring(rootDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Workspace wiring check passed.');
  });

  it('fails when a consumer imports another workspace package src internals', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'workspace-wiring-'));
    tempDirs.push(rootDir);

    createTargetPackage(rootDir, {
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
    });
    createConsumerPackage(
      rootDir,
      { '@dungeon/presenter': 'workspace:*' },
      "import { hidden } from '@dungeon/presenter/src/targeting/index.js';\nvoid hidden;\n",
    );

    const result = runWorkspaceWiring(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('apps/web/src/main.ts:1 imports workspace src internals');
    expect(result.stderr).toContain('@dungeon/presenter/src/targeting/index.js');
  });

  it('fails when a consumer imports a workspace package without declaring it', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'workspace-wiring-'));
    tempDirs.push(rootDir);

    createTargetPackage(rootDir, {
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
    });
    createConsumerPackage(
      rootDir,
      {},
      "import { buildView } from '@dungeon/presenter';\nvoid buildView;\n",
    );

    const result = runWorkspaceWiring(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'apps/web/src/main.ts:1 imports "@dungeon/presenter" but apps/web/package.json does not declare @dungeon/presenter',
    );
  });

  it('fails when a consumer imports an unexported workspace subpath', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'workspace-wiring-'));
    tempDirs.push(rootDir);

    createTargetPackage(rootDir, {
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
    });
    createConsumerPackage(
      rootDir,
      { '@dungeon/presenter': 'workspace:*' },
      "import { getTargeting } from '@dungeon/presenter/targeting';\nvoid getTargeting;\n",
    );

    const result = runWorkspaceWiring(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'apps/web/src/main.ts:1 imports "@dungeon/presenter/targeting" but packages/presenter/package.json does not export "./targeting"',
    );
  });
});
