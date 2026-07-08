/**
 * Test layer: unit
 * Behavior: getPermadeathProximityMessage chooses the correct death-risk copy for unset thresholds, clean kills, low overkill, close calls, and large thresholds.
 * Proof: Assertions expect the five exact message strings for threshold zero, overkill zero, 4/10 overkill, 5/10 overkill, and 100/1000 overkill cases.
 * Validation: pnpm vitest run apps/web/src/utils/permadeath-message.test.ts
 */
import { describe, it, expect } from 'vitest';
import { getPermadeathProximityMessage } from './permadeath-message.js';

describe('getPermadeathProximityMessage', () => {
  it('handles threshold === 0 without division by zero', () => {
    const message = getPermadeathProximityMessage(5, 0);
    expect(message).toBe('The threshold was not set.');
  });

  it('returns clean kill message when overkillDamage === 0', () => {
    const message = getPermadeathProximityMessage(0, 10);
    expect(message).toBe('The blow that killed you was clean — no risk of permanent death.');
  });

  it('returns dangerous message when overkill is < 50% of threshold', () => {
    const message = getPermadeathProximityMessage(4, 10);
    expect(message).toBe('A stronger blow could have ended you for good.');
  });

  it('returns close call message when overkill is >= 50% of threshold', () => {
    const message = getPermadeathProximityMessage(5, 10);
    expect(message).toBe('That was dangerously close to permanent death.');
  });

  it('handles large threshold values', () => {
    const message = getPermadeathProximityMessage(100, 1000);
    expect(message).toBe('A stronger blow could have ended you for good.');
  });
});
