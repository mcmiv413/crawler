import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(new URL('../../scripts/check-tracked-artifacts.mjs', import.meta.url));

function writeFixture(rootDir: string, relativePath: string, source: string): void {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
}

function runGit(rootDir: string, args: string[]): void {
  const result = spawnSync('git', ['-C', rootDir, ...args], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
  }
}

function runTrackedArtifactCheck(rootDir: string) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--root', rootDir], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

function initRepo(rootDir: string): void {
  runGit(rootDir, ['init', '--quiet']);
  runGit(rootDir, ['config', 'user.email', 'test@example.com']);
  runGit(rootDir, ['config', 'user.name', 'Test User']);
}

describe('check-tracked-artifacts script', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('passes when only legitimate tracked files are present', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'tracked-artifacts-'));
    tempDirs.push(rootDir);
    initRepo(rootDir);
    writeFixture(rootDir, 'src/app.ts', 'export const app = true;\n');
    runGit(rootDir, ['add', 'src/app.ts']);
    runGit(rootDir, ['commit', '--quiet', '-m', 'init']);

    const result = runTrackedArtifactCheck(rootDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Tracked artifact check passed.');
  });

  it('fails when a banned generated artifact is already tracked', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'tracked-artifacts-'));
    tempDirs.push(rootDir);
    initRepo(rootDir);
    writeFixture(rootDir, 'dist/index.js.map', '{"version":3}\n');
    runGit(rootDir, ['add', 'dist/index.js.map']);
    runGit(rootDir, ['commit', '--quiet', '-m', 'track artifact']);

    const result = runTrackedArtifactCheck(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dist/index.js.map');
    expect(result.stderr).toContain('JavaScript source maps are generated artifacts');
  });

  it('fails when an ignored cache file is force-added to the index', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'tracked-artifacts-'));
    tempDirs.push(rootDir);
    initRepo(rootDir);
    writeFixture(rootDir, '.gitignore', '.eslintcache*\n');
    writeFixture(rootDir, '.eslintcache-typed', 'cache\n');
    runGit(rootDir, ['add', '.gitignore']);
    runGit(rootDir, ['commit', '--quiet', '-m', 'init']);
    runGit(rootDir, ['add', '--force', '.eslintcache-typed']);

    const result = runTrackedArtifactCheck(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.eslintcache-typed');
    expect(result.stderr).toContain('ESLint caches are local artifacts');
  });
});
