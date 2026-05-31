import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MapView } from '@dungeon/presenter';
import type { ThreeAnimationOverlayProps } from './ThreeAnimationOverlay.js';

const { mockInitializeThreeAnimationModules, mockInnerOverlay } = vi.hoisted(() => ({
  mockInitializeThreeAnimationModules: vi.fn(),
  mockInnerOverlay: vi.fn(() => <div data-testid="three-animation-overlay-inner" />),
}));

vi.mock('../rendering/three/generated/index.js', () => ({
  initializeThreeAnimationModules: mockInitializeThreeAnimationModules,
}));

vi.mock('../rendering/three/ThreeAnimationOverlay.js', () => ({
  ThreeAnimationOverlay: mockInnerOverlay,
}));

import { ThreeAnimationOverlay } from './ThreeAnimationOverlay.js';

function makeProps(overrides?: Partial<ThreeAnimationOverlayProps>): ThreeAnimationOverlayProps {
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
    combatIndicators: [],
    vpLeft: 0,
    vpTop: 0,
    cameraOffset: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('components/ThreeAnimationOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes the generated registry before rendering the lazy overlay', async () => {
    render(<ThreeAnimationOverlay {...makeProps()} />);

    expect(await screen.findByTestId('three-animation-overlay-inner')).toBeInTheDocument();
    expect(mockInitializeThreeAnimationModules).toHaveBeenCalledTimes(1);
  });

  it('stays unloaded when no Three-owned visuals are active', () => {
    const { container } = render(
      <ThreeAnimationOverlay
        {...makeProps()}
        fxAnimations={[]}
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(mockInitializeThreeAnimationModules).not.toHaveBeenCalled();
  });

  it('loads when atmosphereEnabled is true even without active visuals', async () => {
    render(
      <ThreeAnimationOverlay
        {...makeProps({
          consumableAnimations: [],
          fxAnimations: [],
          atmosphereEnabled: true,
        })}
      />,
    );

    expect(await screen.findByTestId('three-animation-overlay-inner')).toBeInTheDocument();
    expect(mockInnerOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ atmosphereEnabled: true }),
      undefined,
    );
  });
});
