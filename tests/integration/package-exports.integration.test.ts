import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(new URL('../../scripts/check-package-exports.mjs', import.meta.url));

function writeFixture(rootDir: string, relativePath: string, source: string): void {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
}

function writeJsonFixture(rootDir: string, relativePath: string, value: unknown): void {
  writeFixture(rootDir, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function linkWorkspacePackage(rootDir: string, packageName: string, packageRelativePath: string): void {
  const targetPath = join(rootDir, packageRelativePath);
  const linkPath = join(rootDir, 'apps/server/node_modules/@dungeon', packageName);
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(targetPath, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

function createWorkspacePackage(
  rootDir: string,
  packageRelativePath: string,
  packageName: string,
  exportsMap: Record<string, unknown>,
  distFiles: Record<string, string>,
): void {
  writeJsonFixture(rootDir, `${packageRelativePath}/package.json`, {
    name: `@dungeon/${packageName}`,
    private: true,
    type: 'module',
    exports: exportsMap,
  });

  for (const [relativePath, source] of Object.entries(distFiles)) {
    writeFixture(rootDir, `${packageRelativePath}/dist/${relativePath}`, source);
  }

  linkWorkspacePackage(rootDir, packageName, packageRelativePath);
}

function createValidFixture(rootDir: string): void {
  writeJsonFixture(rootDir, 'apps/server/package.json', {
    name: '@dungeon/server',
    private: true,
    type: 'module',
  });

  createWorkspacePackage(
    rootDir,
    'packages/game-contracts',
    'contracts',
    {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        default: './dist/index.js',
      },
    },
    {
      'index.js': 'export const contracts = true;\n',
      'index.d.ts': 'export declare const contracts: true;\n',
    },
  );

  createWorkspacePackage(
    rootDir,
    'packages/game-core',
    'core',
    {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        default: './dist/index.js',
      },
      './ai/ai-service.js': {
        types: './dist/ai/ai-service.d.ts',
        import: './dist/ai/ai-service.js',
        default: './dist/ai/ai-service.js',
      },
      './ai/prompt-builders.js': {
        types: './dist/ai/prompt-builders.d.ts',
        import: './dist/ai/prompt-builders.js',
        default: './dist/ai/prompt-builders.js',
      },
      './utils/pathfinding.js': {
        types: './dist/utils/pathfinding.d.ts',
        import: './dist/utils/pathfinding.js',
        default: './dist/utils/pathfinding.js',
      },
      './testing.js': {
        types: './dist/testing/index.d.ts',
        import: './dist/testing/index.js',
        default: './dist/testing/index.js',
      },
    },
    {
      'index.js': 'export const core = true;\n',
      'index.d.ts': 'export declare const core: true;\n',
      'ai/ai-service.js': 'export const aiService = true;\n',
      'ai/ai-service.d.ts': 'export declare const aiService: true;\n',
      'ai/prompt-builders.js': 'export const promptBuilders = true;\n',
      'ai/prompt-builders.d.ts': 'export declare const promptBuilders: true;\n',
      'utils/pathfinding.js': 'export const pathfinding = true;\n',
      'utils/pathfinding.d.ts': 'export declare const pathfinding: true;\n',
      'testing/index.js': 'export const testing = true;\n',
      'testing/index.d.ts': 'export declare const testing: true;\n',
    },
  );

  createWorkspacePackage(
    rootDir,
    'packages/content',
    'content',
    {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        default: './dist/index.js',
      },
    },
    {
      'index.js': 'export const content = true;\n',
      'index.d.ts': 'export declare const content: true;\n',
    },
  );

  createWorkspacePackage(
    rootDir,
    'packages/presenter',
    'presenter',
    {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        default: './dist/index.js',
      },
    },
    {
      'index.js': 'export const presenter = true;\n',
      'index.d.ts': 'export declare const presenter: true;\n',
    },
  );
}

function runPackageExportsCheck(rootDir: string) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--root', rootDir], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

describe('check-package-exports script', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('passes for valid export maps and consumer-context runtime resolution', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'package-exports-'));
    tempDirs.push(rootDir);
    createValidFixture(rootDir);

    const result = runPackageExportsCheck(rootDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OK    export map ordering');
    expect(result.stdout).toContain('@dungeon/core/ai/ai-service.js');
    expect(result.stdout).toContain('All package exports validated successfully from consumer context.');
  });

  it('fails when an export condition object puts default before types', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'package-exports-'));
    tempDirs.push(rootDir);
    createValidFixture(rootDir);
    writeJsonFixture(rootDir, 'packages/game-core/package.json', {
      name: '@dungeon/core',
      private: true,
      type: 'module',
      exports: {
        '.': {
          import: './dist/index.js',
          default: './dist/index.js',
          types: './dist/index.d.ts',
        },
      },
    });

    const result = runPackageExportsCheck(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"types" (pos 2) comes after "default" (pos 1)');
  });

  it('fails when a declared runtime export is missing from dist', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'package-exports-'));
    tempDirs.push(rootDir);
    createValidFixture(rootDir);
    rmSync(join(rootDir, 'packages/game-core/dist/ai/ai-service.js'));

    const result = runPackageExportsCheck(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('FAIL  @dungeon/core/ai/ai-service.js');
    expect(result.stderr).toContain('[workspace consumer cannot resolve]');
  });
});
