import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { auditAllTests, generateReport } from '../../scripts/audit-tests.js';

const BASIC_VITEST_SOURCE = `
import { describe, expect, it } from 'vitest';

describe('fixture', () => {
  it('passes', () => {
    expect(true).toBe(true);
  });
});
`;

const PROPERTY_SOURCE = `
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

describe('property fixture', () => {
  it('checks an invariant', () => {
    fc.assert(fc.property(fc.integer(), (value) => value === value));
    expect(true).toBe(true);
  });
});
`;

const E2E_SOURCE = `
import { expect, test } from '@playwright/test';

test('fixture', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page).toHaveURL(/localhost/);
});
`;

function writeFixture(rootDir: string, relativePath: string, source: string): void {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
}

describe('audit-tests script', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('discovers real test file patterns and reports the correct layers', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'audit-tests-'));
    tempDirs.push(rootDir);

    writeFixture(rootDir, 'tests/e2e/game-loop.spec.ts', E2E_SOURCE);
    writeFixture(rootDir, 'tests/contracts/game-config.contract.test.ts', BASIC_VITEST_SOURCE);
    writeFixture(rootDir, 'tests/integration/game-loop.integration.test.ts', BASIC_VITEST_SOURCE);
    writeFixture(rootDir, 'tests/balance/drop-rates.balance.test.ts', BASIC_VITEST_SOURCE);
    writeFixture(rootDir, 'packages/game-core/src/systems/enemy-ai.property.test.ts', PROPERTY_SOURCE);
    writeFixture(rootDir, 'packages/game-core/src/systems/enemy-ai.balance.test.ts', BASIC_VITEST_SOURCE);
    writeFixture(rootDir, 'packages/game-core/src/systems/enemy-ai.test.ts', BASIC_VITEST_SOURCE);
    writeFixture(rootDir, 'dist/ignored.spec.ts', E2E_SOURCE);

    const results = auditAllTests(rootDir);
    const byPath = new Map(results.map((result) => [result.filePath, result]));
    const report = generateReport(results);

    expect(results).toHaveLength(7);
    expect(byPath.get('tests/e2e/game-loop.spec.ts')?.proposedLayer).toBe('e2e');
    expect(byPath.get('tests/e2e/game-loop.spec.ts')?.includedInDefaultRun).toBe(false);
    expect(byPath.get('tests/e2e/game-loop.spec.ts')?.defaultRunReason).toContain('Playwright-only');
    expect(byPath.get('tests/contracts/game-config.contract.test.ts')?.proposedLayer).toBe('contract');
    expect(byPath.get('tests/integration/game-loop.integration.test.ts')?.proposedLayer).toBe('integration');
    expect(byPath.get('tests/balance/drop-rates.balance.test.ts')?.proposedLayer).toBe('balance');
    expect(byPath.get('tests/balance/drop-rates.balance.test.ts')?.includedInDefaultRun).toBe(false);
    expect(byPath.get('packages/game-core/src/systems/enemy-ai.property.test.ts')?.proposedLayer).toBe('property');
    expect(byPath.get('packages/game-core/src/systems/enemy-ai.balance.test.ts')?.proposedLayer).toBe('balance');
    expect(byPath.get('packages/game-core/src/systems/enemy-ai.balance.test.ts')?.includedInDefaultRun).toBe(false);
    expect(byPath.get('packages/game-core/src/systems/enemy-ai.test.ts')?.proposedLayer).toBe('unit');
    expect(report).toContain('### E2E Tests (1)');
    expect(report).toContain('Runner: Playwright-only');
    expect(report).toContain('### Property Tests (1)');
    expect(report).toContain('## Recognized but Excluded from Default Workspace Run');
    expect(report).toContain('tests/e2e/game-loop.spec.ts');
    expect(report).toContain('packages/game-core/src/systems/enemy-ai.balance.test.ts');
  });
});
