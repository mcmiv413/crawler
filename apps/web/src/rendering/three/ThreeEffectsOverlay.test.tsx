import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MapView } from '@dungeon/presenter';

const { mockThreeAnimationOverlay } = vi.hoisted(() => ({
  mockThreeAnimationOverlay: vi.fn(() => <div data-testid="three-animation-overlay" />),
}));

vi.mock('./ThreeAnimationOverlay.js', () => ({
  ThreeAnimationOverlay: mockThreeAnimationOverlay,
}));

import { ThreeEffectsOverlay } from './ThreeEffectsOverlay.js';

function makeProps() {
  return {
    map: {
      width: 10,
      height: 10,
      biomeId: 'dungeon',
      dangerLevel: 'moderate',
      playerPosition: { x: 5, y: 5 },
      cells: [],
      entities: [],
    } satisfies MapView,
    isEnabled: true,
    vpTilesWidth: 20,
    vpTilesHeight: 15,
    consumableAnimations: [],
    fxAnimations: [],
    statusPresentations: [],
    vpLeft: 0,
    vpTop: 0,
    cameraOffset: { x: 0, y: 0 },
  };
}

describe('ThreeEffectsOverlay', () => {
  it('delegates legacy callers to ThreeAnimationOverlay', () => {
    render(<ThreeEffectsOverlay {...makeProps()} />);

    expect(screen.getByTestId('three-animation-overlay')).toBeInTheDocument();
    expect(mockThreeAnimationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        combatIndicators: [],
        consumableAnimations: [],
        fxAnimations: [],
      }),
      undefined,
    );
  });

  it('forwards legacy visual inputs without touching ownership-only props', () => {
    const statusPresentation = { animationId: 'status.buff.gold-ring-pulse', entityScale: 1.2 };

    render(
      <ThreeEffectsOverlay
        {...makeProps()}
        fxAnimations={[{ id: 'fx-1', animationId: 'fx.impact.forward-slash' } as never]}
        statusPresentations={[statusPresentation]}
      />,
    );

    expect(mockThreeAnimationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        fxAnimations: [{ id: 'fx-1', animationId: 'fx.impact.forward-slash' }],
        statusPresentations: [statusPresentation],
        combatIndicators: [],
      }),
      undefined,
    );
  });
});
