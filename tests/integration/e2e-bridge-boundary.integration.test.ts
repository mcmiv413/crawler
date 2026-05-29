import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('E2E bridge entry boundary guardrail', () => {
  it('keeps the Playwright bridge out of the normal app entry chunk', () => {
    const source = readSource('apps/web/src/main.tsx');

    expect(source).not.toContain("import { installDungeonE2EBridge } from './testing/e2e-bridge.js';");
    expect(source).toContain("window.__DUNGEON_E2E__?.enabled !== true");
    expect(source).toContain("await import('./testing/e2e-bridge.js')");
  });
});
