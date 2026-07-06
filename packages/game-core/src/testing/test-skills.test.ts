import { describe, it, expect } from 'vitest';
import {
  analyzeTestFile,
  type TestAnalysisResult,
} from './test-layer-advisor.js';
import {
  generateBuilder,
  listAvailableBuilders,
} from './test-builder-generator.js';

const CONTENT_MODULE_PATH = '@dungeon/' + 'content';

function joinLines(...lines: string[]): string {
  return lines.join('\n');
}

function contentImport(symbols: string): string {
  return ["import { ", symbols, " } from '", CONTENT_MODULE_PATH, "';"].join('');
}

function exactValueAssertion(expression: string, value: number): string {
  return ['expect(', expression, ')', `.toBe(${String(value)})`, ';'].join('');
}

describe('test-layer-advisor skill', () => {
  describe('analyzeTestFile', () => {
    it('validates unit test with correct patterns', () => {
      const code = `
import { describe, it, expect } from 'vitest';
import { PlayerBuilder } from '../testing/builders/character-builder.js';
import { SeededRng } from '../testing/rng.js';

describe('PlayerStats', () => {
  it('calculates defense bonus correctly', () => {
    const rng = new SeededRng(42);
    const player = new PlayerBuilder().withStats({ defense: 5 }).build();
    expect(player.stats.defense).toBeGreaterThan(0);
  });
});
      `;

      const result = analyzeTestFile(code, 'unit');
      expect(result.layer).toBe('unit');
      expect(result.validated).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('flags unit test importing live config', () => {
      const code = joinLines(
        contentImport('PLAYER_STATS'),
        '',
        "describe('PlayerStats', () => {",
        "  it('matches config', () => {",
        `    ${exactValueAssertion('PLAYER_STATS.maxHealth', 100)}`,
        '  });',
        '});',
      );

      const result = analyzeTestFile(code, 'unit');
      expect(result.issues.length).toBeGreaterThan(0);
      const configIssue = result.issues.find((i) => i.code === 'LIVE_CONTENT_IMPORT_IN_ISOLATED_TEST');
      expect(configIssue).toBeDefined();
    });

    it('flags property test importing live config', () => {
      const code = joinLines(
        contentImport('MAP_GENERATION'),
        "import fc from 'fast-check';",
        '',
        "describe('spawn property', () => {",
        "  it('checks generated values', () => {",
        '    fc.assert(fc.property(fc.integer(), (value) => value <= MAP_GENERATION.maxWidth));',
        '  });',
        '});',
      );

      const result = analyzeTestFile(code, 'property');
      const configIssue = result.issues.find((i) => i.code === 'LIVE_CONTENT_IMPORT_IN_ISOLATED_TEST');
      expect(configIssue).toBeDefined();
      expect(configIssue?.severity).toBe('error');
    });

    it('flags content subpath and deep-relative imports in isolated tests', () => {
      const modulePaths = [
        '@dungeon/content/items',
        '../../packages/content/src/items/index.js',
      ];

      for (const modulePath of modulePaths) {
        const code = joinLines(
          `import { ITEMS } from '${modulePath}';`,
          "it('uses live items', () => {",
          '  expect(ITEMS).toBeDefined();',
          '});',
        );

        const result = analyzeTestFile(code, 'unit');

        expect(result.issues.map(issue => issue.code))
          .toContain('LIVE_CONTENT_IMPORT_IN_ISOLATED_TEST');
      }
    });

    it('allows type-only content imports in isolated tests', () => {
      const code = joinLines(
        "import type { BiomeDefinition } from '@dungeon/content';",
        '',
        "describe('biome fixture', () => {",
        "  it('uses a local typed fixture', () => {",
        "    const biome = { biomeId: 'fixture' } as BiomeDefinition;",
        '    expect(biome.biomeId).toBeDefined();',
        '  });',
        '});',
      );

      const result = analyzeTestFile(code, 'unit');
      expect(result.issues.find((i) => i.code === 'LIVE_CONTENT_IMPORT_IN_ISOLATED_TEST')).toBeUndefined();
    });

    it('flags unseeded randomness', () => {
      const code = `
describe('Combat', () => {
  it('applies random damage', () => {
    const damage = Math.random() * 100;
    expect(damage).toBeGreaterThan(0);
  });
});
      `;

      const result = analyzeTestFile(code, 'unit');
      const unseededIssue = result.issues.find((i) => i.code === 'UNSEEDED_RNG');
      expect(unseededIssue).toBeDefined();
      expect(unseededIssue?.severity).toBe('error');
    });

    it('validates contract test with live config', () => {
      const code = joinLines(
        contentImport('ENEMIES'),
        '',
        "describe('EnemyContent', () => {",
        "  it('all enemies have valid tier', () => {",
        '    Object.values(ENEMIES).forEach((enemy) => {',
        '      expect(enemy.tier).toBeGreaterThan(0);',
        '    });',
        '  });',
        '});',
      );

      const result = analyzeTestFile(code, 'contract');
      expect(result.validated).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('recommends GameState for integration tests', () => {
      const code = `
describe('GameFlow', () => {
  it('player can move', () => {
    const player = new PlayerBuilder().build();
    // No GameState usage
  });
});
      `;

      const result = analyzeTestFile(code, 'integration');
      expect(result.suggestions.some((s) => s.includes('GameState'))).toBe(true);
    });

    it('catches exact value assertions in balance tests', () => {
      const code = joinLines(
        "describe('Balance', () => {",
        "  it('player has correct health', () => {",
        `    ${exactValueAssertion('player.stats.maxHealth', 100)}`,
        '  });',
        '});',
      );

      const result = analyzeTestFile(code, 'balance');
      const exactValueIssue = result.issues.find((i) => i.code === 'BALANCE_TEST_EXACT_VALUE');
      expect(exactValueIssue).toBeDefined();
      expect(exactValueIssue?.severity).toBe('warning');
    });

    it('catches bare multiline tuned values while allowing structural numeric assertions', () => {
      const tunedCode = joinLines(
        "describe('Balance', () => {",
        "  it('checks damage tuning', () => {",
        '    expect(',
        '      damage',
        '    ).toBe(',
        '      17',
        '    );',
        '  });',
        '});',
      );
      const structuralCode = joinLines(
        'expect(items.length).toBe(4);',
        'expect(emptyCount).toBe(0);',
        'expect(singleCount).toBe(1);',
      );

      const tunedResult = analyzeTestFile(tunedCode, 'balance');
      const structuralResult = analyzeTestFile(structuralCode, 'unit');

      expect(tunedResult.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
        'BALANCE_TEST_EXACT_VALUE',
        'VALUE_ASSERTION',
      ]));
      expect(structuralResult.issues.map(issue => issue.code)).not.toContain('VALUE_ASSERTION');
    });

    it('provides confidence score', () => {
      const code = `it('test', () => { expect(true).toBe(true); });`;
      const result = analyzeTestFile(code, 'unit');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('rejects E2E assertions that cannot fail', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('placebo', async () => {",
        '  expect(true).toBeTruthy();',
        '  expect(true).toBe(true);',
        '  expect(controlVisible || true).toBeTruthy();',
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.validated).toBe(false);
      expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
        'E2E_LITERAL_ASSERTION',
        'E2E_OR_TRUE_ASSERTION',
      ]));
    });

    it('rejects multiline E2E assertions that cannot fail', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('multiline placebo', async () => {",
        '  expect(',
        '    true',
        '  ).toBe(',
        '    true',
        '  );',
        '  expect(',
        '    controlVisible || true',
        '  ).toBeTruthy();',
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
        'E2E_LITERAL_ASSERTION',
        'E2E_OR_TRUE_ASSERTION',
      ]));
    });

    it('rejects broad body assertions and graceful skipping in E2E tests', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('optional control', async ({ page }) => {",
        "  const bodyText = await page.locator('body').textContent();",
        '  if (await page.getByRole(\'button\').isVisible().catch(() => false)) {',
        "    try { await page.getByRole('button').click(); } catch {}",
        '  }',
        "  if (await page.getByRole('button').isEnabled()) { await page.getByRole('button').click(); }",
        '  expect(bodyText).toBeTruthy();',
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
        'E2E_BROAD_BODY_ASSERTION',
        'E2E_CONDITIONAL_SKIP',
        'E2E_SWALLOWED_ERROR',
      ]));
      expect(result.issues.filter(issue => issue.code === 'E2E_CONDITIONAL_SKIP').length)
        .toBeGreaterThanOrEqual(2);
    });

    it('rejects inline broad body assertions in E2E tests', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('body content', async ({ page }) => {",
        "  expect(await page.locator('body').textContent()).toBeTruthy();",
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.map(issue => issue.code)).toContain('E2E_BROAD_BODY_ASSERTION');
    });

    it('rejects hard waits, non-visual base64 comparisons, and raw request substring checks', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('movement check', async ({ page }) => {",
        '  await page.waitForTimeout(200);',
        "  const before = (await page.screenshot()).toString('base64');",
        "  const request = await page.waitForRequest(request => request.postData()?.includes('MOVE') ?? false);",
        "  expect(request.postData()).toContain('MOVE');",
        '  expect(before).toBeDefined();',
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
        'E2E_HARD_WAIT',
        'E2E_BASE64_SCREENSHOT_ASSERTION',
        'E2E_RAW_POST_DATA_ASSERTION',
      ]));
      expect(result.issues.filter(issue => issue.code === 'E2E_RAW_POST_DATA_ASSERTION')).toHaveLength(2);
    });

    it('rejects raw request substring checks through assigned postData variables', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('movement request', async ({ page }) => {",
        "  const request = await page.waitForRequest('**/commands');",
        '  const body = request.postData();',
        "  expect(body).toContain('MOVE');",
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.map(issue => issue.code)).toContain('E2E_RAW_POST_DATA_ASSERTION');
    });

    it('rejects aliased postData template, match, and RegExp assertions', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('movement request aliases', async ({ page }) => {",
        "  const request = await page.waitForRequest('**/commands');",
        '  const body = request.postData();',
        '  const bodyAlias = body;',
        "  expect(`payload: ${bodyAlias}`).toContain('MOVE');",
        '  expect(bodyAlias.match(/MOVE/)).not.toBeNull();',
        '  expect(/MOVE/.test(bodyAlias)).toBe(true);',
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.filter(issue => issue.code === 'E2E_RAW_POST_DATA_ASSERTION'))
        .toHaveLength(3);
    });

    it('rejects raw request substring checks through chained postData receivers', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('movement response', async ({ page }) => {",
        "  const response = await page.waitForResponse('**/commands');",
        '  const body = response.request().postData();',
        "  expect(body).toContain('MOVE');",
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.map(issue => issue.code)).toContain('E2E_RAW_POST_DATA_ASSERTION');
    });

    it('does not allow rendering alone to exempt base64 screenshot comparisons', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('rendering comparison', async ({ page }) => {",
        "  const snapshot = (await page.screenshot()).toString('base64');",
        '  expect(snapshot).toBeDefined();',
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.map(issue => issue.code)).toContain('E2E_BASE64_SCREENSHOT_ASSERTION');
    });

    it('rejects base64 conversion of an assigned screenshot buffer', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('movement buffer comparison', async ({ page }) => {",
        '  const shot = await page.screenshot();',
        "  expect(shot.toString('base64')).not.toBe('');",
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.map(issue => issue.code)).toContain('E2E_BASE64_SCREENSHOT_ASSERTION');
    });

    it('allows base64 screenshot comparisons in renderer test titles', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('renderer comparison', async ({ page }) => {",
        "  const snapshot = (await page.screenshot()).toString('base64');",
        '  expect(snapshot).toBeDefined();',
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.map(issue => issue.code)).not.toContain('E2E_BASE64_SCREENSHOT_ASSERTION');
    });

    it('scopes renderer base64 exemptions to the owning test block', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "const moduleSnapshot = async page => (await page.screenshot()).toString('base64');",
        "test('renderer comparison', async ({ page }) => {",
        "  const snapshot = (await page.screenshot()).toString('base64');",
        '  expect(snapshot).toBeDefined();',
        '});',
        "test('movement comparison', async ({ page }) => {",
        "  const snapshot = (await page.screenshot()).toString('base64');",
        '  expect(snapshot).toBeDefined();',
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.issues.filter(issue => issue.code === 'E2E_BASE64_SCREENSHOT_ASSERTION'))
        .toHaveLength(1);
    });

    it('allows documented timing waits, visual snapshots, and structured request parsing', () => {
      const code = joinLines(
        "import { expect, test } from '@playwright/test';",
        "test('visual renderer timing', async ({ page }) => {",
        '  await page.waitForTimeout(200); // audit-allow-waitForTimeout: renderer timing assertion',
        "  const snapshot = (await page.screenshot()).toString('base64');",
        '  const request = await page.waitForRequest(request => {',
        '    try {',
        '      const body = request.postDataJSON() as { type?: string };',
        "      return body.type === 'MOVE';",
        '    } catch {',
        '      return false;',
        '    }',
        '  });',
        "  expect((request.postDataJSON() as { type?: string }).type).toBe('MOVE');",
        '  expect(snapshot.length).toBeGreaterThan(0);',
        '});',
      );

      const result = analyzeTestFile(code, 'e2e');

      expect(result.validated).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});

describe('test-builder-generator skill', () => {
  describe('generateBuilder', () => {
    it('generates PlayerBuilder', () => {
      const code = generateBuilder('Player');
      expect(code).toContain('export class PlayerBuilder');
      expect(code).toContain('withStats');
      expect(code).toContain('withEquipment');
      expect(code).toContain('build()');
      expect(code).toContain('static default()');
    });

    it('generates EnemyBuilder', () => {
      const code = generateBuilder('Enemy');
      expect(code).toContain('export class EnemyBuilder');
      expect(code).toContain('withPosition');
      expect(code).toContain('build()');
    });

    it('generated builder includes imports', () => {
      const code = generateBuilder('Player');
      expect(code).toContain('import');
      expect(code).toContain('@dungeon/contracts');
    });

    it('throws on unknown type', () => {
      expect(() => generateBuilder('UnknownType')).toThrow();
    });

    it('lists all available builders', () => {
      const builders = listAvailableBuilders();
      expect(builders).toContain('Player');
      expect(builders).toContain('Enemy');
      expect(builders).toContain('Item');
      expect(builders).toContain('GameState');
      expect(builders).toContain('SeededRng');
    });
  });

  describe('builder output patterns', () => {
    it('generated code is valid TypeScript syntax', () => {
      const code = generateBuilder('Player');
      // Basic syntax checks
      expect(code).toMatch(/export class \w+Builder/);
      expect(code).toMatch(/build\(\): \w+/);
      expect(code).toMatch(/static default\(\)/);
      expect(code).toMatch(/return this;/);
    });

    it('builder has fluent API (returns this)', () => {
      const code = generateBuilder('Enemy');
      expect(code).toMatch(/return this;/);
      // Should have multiple setter methods
      const returnThisMatches = code.match(/return this;/g);
      expect(returnThisMatches?.length).toBeGreaterThanOrEqual(1);
    });

    it('builder includes default() factory method', () => {
      const code = generateBuilder('Item');
      expect(code).toContain('static default()');
      expect(code).toContain('new ItemBuilder().build()');
    });
  });
});

describe('skill integration', () => {
  it('advisor validates generated builder usage', () => {
    const generatedBuilder = generateBuilder('Player');
    const testCode = joinLines(
      "import { PlayerBuilder } from './builders.js';",
      generatedBuilder,
      '',
      "describe('Player', () => {",
      "  it('uses builder', () => {",
      '    const player = new PlayerBuilder().withStats({ health: 50 }).build();',
      `    ${exactValueAssertion('player.stats.health', 50)}`,
      '  });',
      '});',
    );

    const analysis = analyzeTestFile(testCode, 'unit');
    // Should recognize correct builder usage
    expect(analysis.suggestions.length).toBeLessThan(3); // No major issues
  });
});
