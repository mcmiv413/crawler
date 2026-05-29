import { afterEach, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import pluginDungeon from '../../packages/eslint-plugin-dungeon/src/index.js';

function writeFixture(rootDir: string, relativePath: string, source: string): string {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
  return absolutePath;
}

async function lintFixture(
  source: string,
  rules: Record<string, string> = {
    'dungeon/no-unsafe-test-contract-cast': 'error',
  },
) {
  const rootDir = mkdtempSync(join(tmpdir(), 'eslint-plugin-dungeon-'));
  tempDirs.push(rootDir);
  const filePath = writeFixture(rootDir, 'fixture.test.ts', source);
  const eslint = new ESLint({
    cwd: rootDir,
    ignore: false,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.test.ts'],
        plugins: {
          dungeon: pluginDungeon as { readonly rules: Record<string, unknown> },
        },
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
          },
        },
        rules,
      },
    ],
  });

  const [result] = await eslint.lintFiles([filePath.slice(rootDir.length + 1)]);
  return result?.messages ?? [];
}

const tempDirs: string[] = [];

describe('eslint-plugin-dungeon', () => {
  afterEach(() => {
    for (const tempDir of tempDirs) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('flags as unknown as GameState in tests', async () => {
    const messages = await lintFixture(
      [
        "import type { GameState } from '@dungeon/contracts';",
        'const state = {} as unknown as GameState;',
      ].join('\n'),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.ruleId).toBe('dungeon/no-unsafe-test-contract-cast');
  });

  it('flags intersections that still target GameView', async () => {
    const messages = await lintFixture(
      [
        "import type { GameView } from '@dungeon/presenter';",
        "type CombatLogEntry = { text: string };",
        'const view = {} as unknown as GameView & { combatLog: CombatLogEntry[] };',
      ].join('\n'),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain('GameView');
  });

  it('allows narrower test-only shapes without public contract double casts', async () => {
    const messages = await lintFixture(
      [
        "type LocalShape = { code?: string };",
        'const error = {} as LocalShape;',
        'void error;',
      ].join('\n'),
    );

    expect(messages).toEqual([]);
  });

  it('flags direct calls to imports from a mocked module', async () => {
    const messages = await lintFixture(
      [
        "import { describe, it, vi } from 'vitest';",
        "import { runSubject } from './subject.js';",
        "vi.mock('./subject.js', () => ({ runSubject: vi.fn() }));",
        "describe('subject', () => {",
        "  it('runs behavior', () => {",
        "    runSubject();",
        "  });",
        "});",
      ].join('\n'),
      { 'dungeon/no-mocked-subject-call': 'error' },
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.ruleId).toBe('dungeon/no-mocked-subject-call');
    expect(messages[0]?.message).toContain('runSubject');
  });

  it('flags mocked imports passed to behavior execution helpers', async () => {
    const messages = await lintFixture(
      [
        "import { renderHook } from '@testing-library/react';",
        "import { vi } from 'vitest';",
        "import { useSubject } from './subject.js';",
        "vi.mock('./subject.js', () => ({ useSubject: vi.fn() }));",
        'renderHook(useSubject);',
      ].join('\n'),
      { 'dungeon/no-mocked-subject-call': 'error' },
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.ruleId).toBe('dungeon/no-mocked-subject-call');
  });

  it('allows executing a real subject while mocked dependencies are asserted', async () => {
    const messages = await lintFixture(
      [
        "import { expect, vi } from 'vitest';",
        "import { dependency } from './dependency.js';",
        "import { runSubject } from './subject.js';",
        "vi.mock('./dependency.js', () => ({ dependency: vi.fn() }));",
        'runSubject();',
        'expect(vi.mocked(dependency)).toHaveBeenCalled();',
      ].join('\n'),
      { 'dungeon/no-mocked-subject-call': 'error' },
    );

    expect(messages).toEqual([]);
  });
});
