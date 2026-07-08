/**
 * Test layer: unit
 * Behavior: filterCombatLogForDisplay preserves normal log entries while hiding uppercase [DEBUG] entries when debug mode is off.
 * Proof: Returned arrays are asserted for debugMode true passthrough, debugMode false filtering, preserved order, empty inputs, all-debug inputs, and lowercase [debug] retention.
 * Validation: pnpm vitest run apps/web/src/components/__tests__/log-filter.test.ts
 */
import { describe, it, expect } from 'vitest';
import { filterCombatLogForDisplay, type CombatLogEntry } from '../combat-log-filter';

describe('filterCombatLogForDisplay', () => {
  const normalEntry: CombatLogEntry = {
    text: 'Player attacks enemy',
    type: 'attack',
  };

  const debugEntry: CombatLogEntry = {
    text: '[DEBUG] Miss streak detected',
    type: 'debug',
  };

  const anotherDebugEntry: CombatLogEntry = {
    text: '[DEBUG] Damage calc: 15 * 1.2 = 18',
    type: 'debug',
  };

  it('passes all entries when debugMode is true', () => {
    const entries = [normalEntry, debugEntry, anotherDebugEntry];
    const result = filterCombatLogForDisplay(entries, true);
    expect(result).toEqual(entries);
  });

  it('filters out [DEBUG]-prefixed entries when debugMode is false', () => {
    const entries = [normalEntry, debugEntry, anotherDebugEntry];
    const result = filterCombatLogForDisplay(entries, false);
    expect(result).toEqual([normalEntry]);
  });

  it('preserves order of remaining entries', () => {
    const entries = [
      normalEntry,
      debugEntry,
      { text: 'Enemy attacks back', type: 'attack' },
      anotherDebugEntry,
      { text: 'Player takes damage', type: 'damage' },
    ];
    const result = filterCombatLogForDisplay(entries, false);
    expect(result).toEqual([normalEntry, entries[2], entries[4]]);
  });

  it('handles empty array', () => {
    const result = filterCombatLogForDisplay([], false);
    expect(result).toEqual([]);
  });

  it('handles array with only debug entries', () => {
    const entries = [debugEntry, anotherDebugEntry];
    const result = filterCombatLogForDisplay(entries, false);
    expect(result).toEqual([]);
  });

  it('is case-sensitive on [DEBUG] prefix', () => {
    const entries = [
      { text: '[debug] lowercase', type: 'debug' },
      { text: '[DEBUG] uppercase', type: 'debug' },
    ];
    const result = filterCombatLogForDisplay(entries, false);
    // Only the uppercase [DEBUG] entry should be filtered
    expect(result).toEqual([entries[0]]);
  });
});
