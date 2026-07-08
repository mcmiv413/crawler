/**
 * Test layer: unit
 * Behavior: The unit config test documents that balance-constants coverage lives in the contract test suite.
 * Proof: Assertion checks the balance-constants contract test file exists at tests/contracts/balance-constants.contract.test.ts.
 * Validation: pnpm vitest run packages/game-core/src/config.test.ts
 */
/**
 * Balance constants governance tests moved to:
 * tests/contracts/balance-constants.contract.test.ts
 *
 * Those tests validate live @dungeon/content exports and belong
 * in the contract layer, not the unit layer.
 */

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('config test migration note', () => {
  it('keeps balance-constants coverage in the contract layer', () => {
    expect(
      existsSync(new URL('../../../tests/contracts/balance-constants.contract.test.ts', import.meta.url)),
    ).toBe(true);
  });
});
