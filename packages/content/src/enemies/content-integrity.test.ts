/**
 * Enemy content integrity tests have been moved to the contract layer.
 *
 * See: tests/contracts/enemy-integrity.contract.test.ts
 *
 * Rationale: these tests cross-reference live content from multiple modules
 * (enemies, biomes, factions) using @dungeon/content public exports.
 * Running them inside packages/content/ risks circular imports and violates
 * the rule that intra-package tests should not import live catalog data.
 */

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('enemy integrity migration note', () => {
  it('keeps enemy-integrity coverage in the contract layer', () => {
    expect(
      existsSync(new URL('../../../../tests/contracts/enemy-integrity.contract.test.ts', import.meta.url)),
    ).toBe(true);
  });
});
