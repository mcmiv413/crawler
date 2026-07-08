/**
 * Test layer: unit
 * Behavior: ThreeEffectsOverlay covers componentsThreeEffectsOverlay; routes legacy imports through the modern ThreeAnimationOverlay wrapper.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/components/ThreeEffectsOverlay.test.tsx
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MapView } from '@dungeon/presenter';

const { mockThreeAnimationOverlay } = vi.hoisted(() => ({
  mockThreeAnimationOverlay: vi.fn(() => <div data-testid="three-animation-overlay-wrapper" />),
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
    moveAnimations: [],
    bumpAnimations: [],
    consumableAnimations: [],
    fxAnimations: [{ id: 'fx-1', animationId: 'fx.impact.forward-slash' }] as never,
    statusPresentations: [],
    vpLeft: 0,
    vpTop: 0,
    cameraOffset: { x: 0, y: 0 },
  };
}

describe('components/ThreeEffectsOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes legacy imports through the modern ThreeAnimationOverlay wrapper', () => {
    render(<ThreeEffectsOverlay {...makeProps()} />);

    expect(screen.getByTestId('three-animation-overlay-wrapper')).toBeInTheDocument();
    expect(mockThreeAnimationOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        combatIndicators: [],
        fxAnimations: [{ id: 'fx-1', animationId: 'fx.impact.forward-slash' }],
      }),
      undefined,
    );
  });
});
