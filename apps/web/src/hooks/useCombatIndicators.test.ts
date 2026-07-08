/**
 * Test layer: unit
 * Behavior: useCombatIndicators accepts empty, repeated, and mixed combat indicator inputs without throwing during hook render or rerender.
 * Proof: Assertions wrap renderHook and rerender in not.toThrow for damage, heal, status, gold, mixed, same-position, empty, and multi-indicator arrays.
 * Validation: pnpm vitest run apps/web/src/hooks/useCombatIndicators.test.ts
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CombatIndicatorEntry } from '@dungeon/presenter';
import { useCombatIndicators } from './useCombatIndicators.js';

describe('useCombatIndicators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not throw when given valid inputs', () => {
    const indicators: readonly CombatIndicatorEntry[] = [
      { text: '-25', type: 'damage', x: 5, y: 5 },
    ];

    expect(() => {
      renderHook(() => useCombatIndicators(indicators));
    }).not.toThrow();
  });

  it('should handle empty indicator array', () => {
    expect(() => {
      renderHook(() => useCombatIndicators([]));
    }).not.toThrow();
  });

  it('should handle multiple indicators', () => {
    const indicators: readonly CombatIndicatorEntry[] = [
      { text: '-25', type: 'damage', x: 5, y: 5 },
      { text: '-8', type: 'damage', x: 10, y: 10 },
      { text: 'Poison', type: 'status', x: 5, y: 5 },
      { text: '+30', type: 'heal', x: 10, y: 10 },
    ];

    expect(() => {
      renderHook(() => useCombatIndicators(indicators));
    }).not.toThrow();
  });

  it('should handle rerender with new indicators', () => {
    const initialIndicators: readonly CombatIndicatorEntry[] = [
      { text: '-25', type: 'damage', x: 5, y: 5 },
    ];

    const { rerender } = renderHook(
      ({ indicators }) => useCombatIndicators(indicators),
      { initialProps: { indicators: initialIndicators } },
    );

    // Re-render with same indicators
    expect(() => {
      rerender({ indicators: initialIndicators });
    }).not.toThrow();

    // Add new indicators
    const newIndicators: readonly CombatIndicatorEntry[] = [
      ...initialIndicators,
      { text: '-8', type: 'damage', x: 10, y: 10 },
    ];

    expect(() => {
      rerender({ indicators: newIndicators });
    }).not.toThrow();
  });

  it('should handle various damage indicators', () => {
    const indicators: readonly CombatIndicatorEntry[] = [
      { text: '-1', type: 'damage', x: 0, y: 0 },
      { text: '-25', type: 'damage', x: 5, y: 5 },
      { text: '-100', type: 'damage', x: 50, y: 50 },
      { text: 'miss', type: 'damage', x: 25, y: 25 },
    ];

    expect(() => {
      renderHook(() => useCombatIndicators(indicators));
    }).not.toThrow();
  });

  it('should handle heal indicators', () => {
    const indicators: readonly CombatIndicatorEntry[] = [
      { text: '+10', type: 'heal', x: 10, y: 10 },
      { text: '+50', type: 'heal', x: 15, y: 15 },
      { text: '+100', type: 'heal', x: 20, y: 20 },
    ];

    expect(() => {
      renderHook(() => useCombatIndicators(indicators));
    }).not.toThrow();
  });

  it('should handle status indicators', () => {
    const indicators: readonly CombatIndicatorEntry[] = [
      { text: 'Poison', type: 'status', x: 5, y: 5 },
      { text: 'Stun', type: 'status', x: 6, y: 6 },
      { text: 'Weakness', type: 'status', x: 7, y: 7 },
    ];

    expect(() => {
      renderHook(() => useCombatIndicators(indicators));
    }).not.toThrow();
  });

  it('should handle gold indicators', () => {
    const indicators: readonly CombatIndicatorEntry[] = [
      { text: '+10g', type: 'gold', x: 10, y: 10 },
      { text: '+50g', type: 'gold', x: 15, y: 15 },
      { text: '+100g', type: 'gold', x: 20, y: 20 },
    ];

    expect(() => {
      renderHook(() => useCombatIndicators(indicators));
    }).not.toThrow();
  });

  it('should handle mixed indicator types', () => {
    const indicators: readonly CombatIndicatorEntry[] = [
      { text: '-25', type: 'damage', x: 5, y: 5 },
      { text: '+30', type: 'heal', x: 10, y: 10 },
      { text: 'Poison', type: 'status', x: 6, y: 6 },
      { text: '+50g', type: 'gold', x: 8, y: 8 },
    ];

    expect(() => {
      renderHook(() => useCombatIndicators(indicators));
    }).not.toThrow();
  });

  it('should handle indicators at same position', () => {
    const indicators: readonly CombatIndicatorEntry[] = [
      { text: '-25', type: 'damage', x: 5, y: 5 },
      { text: 'Poison', type: 'status', x: 5, y: 5 },
      { text: '+10', type: 'heal', x: 5, y: 5 },
    ];

    expect(() => {
      renderHook(() => useCombatIndicators(indicators));
    }).not.toThrow();
  });
});
