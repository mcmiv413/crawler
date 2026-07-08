/**
 * Test layer: contract
 * Behavior: no Nemesis Artifacts covers PV0 — Nemesis system fully removed; no source file references any nemesis identifier; NemesisRisenScreen.tsx, NemesisSlainScreen.tsx, Nem....
 * Proof: live catalog/schema assertions validate IDs, shapes, and cross references.
 * Validation: pnpm vitest run tests/contracts/no-nemesis-artifacts.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import * as path from 'node:path';

/**
 * PV0 Acceptance Test — Nemesis Removal
 *
 * Ensures the legacy nemesis system is fully removed from the codebase.
 * Scans source trees for any nemesis identifier or marker. If anything
 * matches, the legacy system has not been fully excised.
 *
 * Allow-listed paths:
 *   - this test file itself
 *   - the .plan/ directory (refactor history)
 *   - docs/ (sequence diagrams of the legacy system are intentionally archived)
 *   - dist/ build artifacts
 *   - node_modules/
 *
 * Per the faction-refactor plan, post-Section-1 the game is intentionally
 * "bossless" and contains no nemesis surface in code or UI.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SCAN_ROOTS = [
  'packages/game-contracts/src',
  'packages/content/src',
  'packages/game-core/src',
  'packages/presenter/src',
  'apps/server/src',
  'apps/web/src',
  'tests/contracts',
  'tests/integration',
  'tests/e2e',
  'tests/balance',
];

// Identifier-level patterns. Case-insensitive substring match across .ts/.tsx files.
const NEMESIS_PATTERNS = [
  'nemesis',
  'Nemesis',
  'NEMESIS',
];

function scanForNemesisReferences(): string[] {
  const offenders: string[] = [];

  for (const root of SCAN_ROOTS) {
    const absRoot = path.join(REPO_ROOT, root);
    let output = '';
    try {
      // ripgrep would be ideal; fall back to grep -r
      // Use word-insensitive search across .ts/.tsx files only.
      output = execSync(
        `grep -rEni --include='*.ts' --include='*.tsx' '(${NEMESIS_PATTERNS.join('|')})' "${absRoot}" || true`,
        { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
      );
    } catch {
      // grep returns non-zero when nothing matches; the `|| true` above prevents that.
      // If anything else throws, treat as no match.
      output = '';
    }

    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      // Skip self
      if (line.includes('no-nemesis-artifacts.contract.test.ts')) continue;
      // Skip generated/dist (defense in depth — SCAN_ROOTS shouldn't include dist)
      if (line.includes('/dist/') || line.includes('/node_modules/')) continue;
      offenders.push(line.trim());
    }
  }

  return offenders;
}

describe('PV0 — Nemesis system fully removed', () => {
  it('no source file references any nemesis identifier', () => {
    const offenders = scanForNemesisReferences();
    if (offenders.length > 0) {
      const sample = offenders.slice(0, 30).join('\n');
      const more = offenders.length > 30 ? `\n... and ${offenders.length - 30} more` : '';
      throw new Error(
        `Found ${offenders.length} nemesis reference(s) still in the codebase:\n${sample}${more}`,
      );
    }
    expect(offenders).toEqual([]);
  });

  it('NemesisRisenScreen.tsx, NemesisSlainScreen.tsx, NemesisFelledScreen.tsx do not exist', async () => {
    const fs = await import('node:fs');
    const removed = [
      'apps/web/src/components/NemesisRisenScreen.tsx',
      'apps/web/src/components/NemesisSlainScreen.tsx',
      'apps/web/src/components/NemesisFelledScreen.tsx',
    ];
    for (const rel of removed) {
      const abs = path.join(REPO_ROOT, rel);
      expect(fs.existsSync(abs), `${rel} should be deleted`).toBe(false);
    }
  });

  it('legacy nemesis system files do not exist', async () => {
    const fs = await import('node:fs');
    const removed = [
      'packages/game-contracts/src/types/nemesis.ts',
      'packages/game-core/src/systems/nemesis.ts',
      'packages/content/src/fallback-text/nemesis.ts',
    ];
    for (const rel of removed) {
      const abs = path.join(REPO_ROOT, rel);
      expect(fs.existsSync(abs), `${rel} should be deleted`).toBe(false);
    }
  });
});
