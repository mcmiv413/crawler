import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { CombatIndicators, emitCombatIndicator } from './CombatIndicators.js';

describe('CombatIndicators', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(
      <CombatIndicators
        entities={[{ id: 'enemy1', x: 5, y: 5, ascii: 'G', color: '#f00', name: 'Goblin', type: 'enemy' as const, templateId: 'goblin' }]}
        vpLeft={0}
        vpTop={0}
        cellSize={24}
        fadeOutDuration={500}
      />,
    );
    expect(container).toBeInTheDocument();
  });

  it('should render floating labels when indicators are emitted', async () => {
    render(
      <CombatIndicators
        entities={[{ id: 'enemy1', x: 5, y: 5, ascii: 'G', color: '#f00', name: 'Goblin', type: 'enemy' as const, templateId: 'goblin' }]}
        vpLeft={0}
        vpTop={0}
        cellSize={24}
        fadeOutDuration={500}
      />,
    );

    // Emit a damage indicator
    emitCombatIndicator(5, 5, '-15', 'damage');

    // Check that the label appears
    await waitFor(
      () => {
        expect(screen.getByText('-15')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('should apply correct styling for damage indicators', async () => {
    render(
      <CombatIndicators
        entities={[]}
        vpLeft={0}
        vpTop={0}
        cellSize={24}
        fadeOutDuration={500}
      />,
    );

    emitCombatIndicator(5, 5, '-20', 'damage');

    await waitFor(
      () => {
        const label = screen.getByText('-20');
        expect(label).toHaveStyle({ color: '#f44' });
      },
      { timeout: 2000 },
    );
  });

  it('should apply correct styling for heal indicators', async () => {
    render(
      <CombatIndicators
        entities={[]}
        vpLeft={0}
        vpTop={0}
        cellSize={24}
        fadeOutDuration={500}
      />,
    );

    emitCombatIndicator(5, 5, '+10', 'heal');

    await waitFor(
      () => {
        const label = screen.getByText('+10');
        expect(label).toHaveStyle({ color: '#4f4' });
      },
      { timeout: 2000 },
    );
  });

  it('should apply correct styling for status indicators', async () => {
    render(
      <CombatIndicators
        entities={[]}
        vpLeft={0}
        vpTop={0}
        cellSize={24}
        fadeOutDuration={500}
      />,
    );

    emitCombatIndicator(5, 5, 'Poisoned!', 'status');

    await waitFor(
      () => {
        const label = screen.getByText('Poisoned!');
        expect(label).toHaveStyle({ color: '#fa4' });
      },
      { timeout: 2000 },
    );
  });

  it('should position labels correctly based on viewport', async () => {
    render(
      <CombatIndicators
        entities={[]}
        vpLeft={2}
        vpTop={2}
        cellSize={24}
        fadeOutDuration={500}
      />,
    );

    emitCombatIndicator(5, 5, '-15', 'damage');

    await waitFor(
      () => {
        const label = screen.getByText('-15');
        // Label should be positioned at (5-2)*24 + 12 = 84px from left, same for top
        const style = label.getAttribute('style');
        expect(style).toContain('left');
        expect(style).toContain('84px');
      },
      { timeout: 2000 },
    );
  });

  it('should handle multiple concurrent indicators', async () => {
    render(
      <CombatIndicators
        entities={[]}
        vpLeft={0}
        vpTop={0}
        cellSize={24}
        fadeOutDuration={500}
      />,
    );

    emitCombatIndicator(5, 5, '-15', 'damage');
    emitCombatIndicator(6, 6, '+10', 'heal');
    emitCombatIndicator(4, 4, 'Stunned!', 'status');

    await waitFor(
      () => {
        expect(screen.getByText('-15')).toBeInTheDocument();
        expect(screen.getByText('+10')).toBeInTheDocument();
        expect(screen.getByText('Stunned!')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('should have correct text shadow styling', async () => {
    render(
      <CombatIndicators
        entities={[]}
        vpLeft={0}
        vpTop={0}
        cellSize={24}
        fadeOutDuration={500}
      />,
    );

    emitCombatIndicator(5, 5, '-15', 'damage');

    await waitFor(
      () => {
        const label = screen.getByText('-15');
        expect(label).toHaveStyle({ textShadow: '0 0 2px #000, 0 0 4px #000' });
      },
      { timeout: 2000 },
    );
  });

  it('should not allow pointer events on labels', async () => {
    render(
      <CombatIndicators
        entities={[]}
        vpLeft={0}
        vpTop={0}
        cellSize={24}
        fadeOutDuration={500}
      />,
    );

    emitCombatIndicator(5, 5, '-15', 'damage');

    await waitFor(
      () => {
        const label = screen.getByText('-15');
        expect(label).toHaveStyle({ pointerEvents: 'none' });
      },
      { timeout: 2000 },
    );
  });

  it('should emit custom event with correct data', () => {
    const eventListener = vi.fn();
    window.addEventListener('combat-indicator', eventListener);

    emitCombatIndicator(5, 5, '-15', 'damage');

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          x: 5,
          y: 5,
          text: '-15',
          type: 'damage',
        }),
      }),
    );

    window.removeEventListener('combat-indicator', eventListener);
  });

  it('should use monospace font for labels', async () => {
    render(
      <CombatIndicators
        entities={[]}
        vpLeft={0}
        vpTop={0}
        cellSize={24}
        fadeOutDuration={500}
      />,
    );

    emitCombatIndicator(5, 5, '-15', 'damage');

    await waitFor(
      () => {
        const label = screen.getByText('-15');
        expect(label).toHaveStyle({ fontFamily: 'monospace' });
      },
      { timeout: 2000 },
    );
  });
});
