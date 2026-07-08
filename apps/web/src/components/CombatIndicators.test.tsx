/**
 * Test layer: unit
 * Behavior: CombatIndicators covers CombatIndicators; renders nothing when the runtime supplies no labels; positions labels relative to the viewport and fade progress.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/components/CombatIndicators.test.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import type { FloatingCombatIndicator } from '../hooks/useCombatIndicatorState.js';
import { CombatIndicators } from './CombatIndicators.js';

const FIXED_NOW = 10_000;

function createLabel(
  overrides: Partial<FloatingCombatIndicator> = {},
): FloatingCombatIndicator {
  return {
    id: 'label-0',
    x: 5,
    y: 5,
    text: '-15',
    type: 'damage',
    startTime: FIXED_NOW,
    ...overrides,
  };
}

function renderIndicators(
  labels: readonly FloatingCombatIndicator[],
  overrides: Partial<{
    vpLeft: number;
    vpTop: number;
    cellSize: number;
    fadeOutDuration: number;
  }> = {},
) {
  return render(
    <CombatIndicators
      vpLeft={overrides.vpLeft ?? 0}
      vpTop={overrides.vpTop ?? 0}
      cellSize={overrides.cellSize ?? 24}
      fadeOutDuration={overrides.fadeOutDuration ?? 500}
      labels={labels}
    />,
  );
}

describe('CombatIndicators', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when the runtime supplies no labels', () => {
    const { container } = renderIndicators([]);

    expect(container.firstChild).toBeNull();
  });

  it.each([
    ['damage', '-20', '#f44'],
    ['heal', '+10', '#4f4'],
    ['status', 'Poisoned!', '#fa4'],
    ['gold', '+35g', '#fd4'],
  ] as const)('renders %s labels with the expected color', (type, text, color) => {
    renderIndicators([
      createLabel({
        id: `label-${type}`,
        text,
        type,
      }),
    ]);

    expect(screen.getByText(text)).toHaveStyle({ color });
  });

  it('positions labels relative to the viewport and fade progress', () => {
    renderIndicators(
      [createLabel({ startTime: FIXED_NOW - 100 })],
      { vpLeft: 2, vpTop: 2 },
    );

    const label = screen.getByText('-15');

    expect(label.style.left).toBe('96px');
    expect(label.style.top).toBe('69px');
    expect(label.style.opacity).toBe('0.8');
  });

  it('stacks overlapping labels in arrival order', () => {
    renderIndicators([
      createLabel({ id: 'label-1', text: '-15' }),
      createLabel({ id: 'label-2', text: '+10', type: 'heal' }),
    ]);

    expect(screen.getByText('-15').style.top).toBe('120px');
    expect(screen.getByText('+10').style.top).toBe('134px');
  });

  it('applies the shared label styling to rendered indicators', () => {
    renderIndicators([createLabel()]);

    expect(screen.getByText('-15')).toHaveStyle({
      textShadow: '0 0 3px #000, 0 0 6px #000, 0 0 2px rgba(0,0,0,0.8)',
      pointerEvents: 'none',
      fontFamily: 'monospace',
      fontWeight: 'bold',
    });
  });
});
