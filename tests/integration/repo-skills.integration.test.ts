/**
 * Test layer: integration
 * Behavior: Repo Skills covers repo skill sync tooling; generates all mirror trees from canonical docsskills; passes the mirror check after generation.
 * Proof: integrated command, service, or repository assertions verify the cross-module result.
 * Validation: pnpm vitest run tests/integration/repo-skills.integration.test.ts
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GENERATE_SCRIPT_PATH = fileURLToPath(
  new URL('../../scripts/generate-repo-skills.mjs', import.meta.url),
);
const CHECK_SCRIPT_PATH = fileURLToPath(new URL('../../scripts/check-repo-skills.mjs', import.meta.url));

function writeFixture(rootDir: string, relativePath: string, source: string): void {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
}

function runScript(scriptPath: string, rootDir: string) {
  return spawnSync(process.execPath, [scriptPath, '--root', rootDir], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

describe('repo skill sync tooling', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('generates all mirror trees from canonical docs/skills', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'repo-skills-'));
    tempDirs.push(rootDir);

    writeFixture(
      rootDir,
      'docs/skills/planning/SKILL.md',
      ['---', 'name: planning', 'description: planning skill', '---', '', '# Planning'].join('\n'),
    );
    writeFixture(rootDir, 'docs/skills/planning/references/checklist.md', '# checklist\n');
    writeFixture(
      rootDir,
      'docs/skills/research/SKILL.md',
      ['---', 'name: research', 'description: research skill', '---', '', '# Research'].join('\n'),
    );
    writeFixture(rootDir, '.agents/skills/stale/SKILL.md', '# stale\n');

    const result = runScript(GENERATE_SCRIPT_PATH, rootDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Generated 2 repo skills');
    expect(readFileSync(join(rootDir, '.github/skills/planning/SKILL.md'), 'utf8')).toContain(
      'name: planning',
    );
    expect(readFileSync(join(rootDir, '.claude/skills/research/SKILL.md'), 'utf8')).toContain(
      'name: research',
    );
    expect(existsSync(join(rootDir, '.agents/skills/stale'))).toBe(false);
  });

  it('passes the mirror check after generation', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'repo-skills-'));
    tempDirs.push(rootDir);

    writeFixture(
      rootDir,
      'docs/skills/task-intake/SKILL.md',
      ['---', 'name: task-intake', 'description: intake skill', '---', '', '# Task Intake'].join('\n'),
    );

    expect(runScript(GENERATE_SCRIPT_PATH, rootDir).status).toBe(0);

    const result = runScript(CHECK_SCRIPT_PATH, rootDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Repo skill mirrors match');
  });

  it('fails the mirror check when a runtime copy drifts', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'repo-skills-'));
    tempDirs.push(rootDir);

    writeFixture(
      rootDir,
      'docs/skills/quick-task/SKILL.md',
      ['---', 'name: quick-task', 'description: quick-task skill', '---', '', '# Quick Task'].join(
        '\n',
      ),
    );

    expect(runScript(GENERATE_SCRIPT_PATH, rootDir).status).toBe(0);
    writeFixture(rootDir, '.github/skills/quick-task/SKILL.md', '# drifted\n');

    const result = runScript(CHECK_SCRIPT_PATH, rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Mirror file differs for .github/skills: quick-task/SKILL.md');
  });
});
