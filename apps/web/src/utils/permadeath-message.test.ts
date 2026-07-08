/**
 * Test layer: unit
 * Behavior: Permadeath Message covers getPermadeathProximityMessage; handles threshold === 0 without division by zero; returns clean kill message when overkillDamage === 0.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
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
