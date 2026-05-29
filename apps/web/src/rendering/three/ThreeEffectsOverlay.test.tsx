/**
 * Tests for the ThreeEffectsOverlay React component.
 *
 * ThreeEffectsOverlay mounts a Three.js WebGL canvas on top of the dungeon
 * canvas. It is transparent, has pointer-events: none, and renders only when
 * the feature flag is enabled, a map is present, and at least one animation
 * is active.
 *
 * All WebGL / Three.js renderer calls are mocked so these tests never touch
 * real GPU resources and run cleanly in happy-dom.
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { MapView, ConsumableAnimationEntry, AbilityAnimationEntry, StatusPresentationView } from '@dungeon/presenter';

// ---------------------------------------------------------------------------
// Fixed constants — must NOT import from ui-config to stay unit-isolated
// ---------------------------------------------------------------------------

const CELL_SIZE = 24; // mirrors ui-config.CELL_SIZE

// ---------------------------------------------------------------------------
// Mock the renderer factory so no real WebGL context is required.
//
// The component under test is expected to accept an optional `createRenderer`
// prop (or import a factory it delegates to) that we intercept here.  We use
// vi.hoisted so the mock is available before the import of the module itself.
// ---------------------------------------------------------------------------

const { mockCreateRenderer, mockRenderer } = vi.hoisted(() => {
  const mockRenderer = {
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: null as HTMLCanvasElement | null,
    scene: {} as any,
    camera: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      updateProjectionMatrix: vi.fn(),
    } as any,
  };

  const mockCreateRenderer = vi.fn(() => {
    // Provide a real canvas element so the component can attach it to the DOM
    mockRenderer.domElement = document.createElement('canvas');
    return mockRenderer;
  });

  return { mockCreateRenderer, mockRenderer };
});

// Mock the three-renderer-factory module (path matches what the component will import)
vi.mock('./three-renderer-factory.js', () => ({
  createThreeRenderer: mockCreateRenderer,
}));

// ---------------------------------------------------------------------------
// Deferred import — component is loaded AFTER the mock is wired
// ---------------------------------------------------------------------------

import { ThreeEffectsOverlay } from './ThreeEffectsOverlay.js';
import type { ThreeEffectsOverlayProps } from './ThreeEffectsOverlay.js';

// ---------------------------------------------------------------------------
// Local fixture factories — no live content imports
// ---------------------------------------------------------------------------

/** Minimal MapView that satisfies the presenter type. */
function makeMap(overrides?: Partial<MapView>): MapView {
  return {
    width: 10,
    height: 10,
    biomeId: 'dungeon',
    dangerLevel: 'moderate',
    playerPosition: { x: 5, y: 5 },
    cells: [],
    entities: [],
    ...overrides,
  };
}

/** Minimal active ConsumableAnimationEntry. */
function makeConsumableAnimation(
  overrides?: Partial<ConsumableAnimationEntry & { id: string; startTime: number; progress: number; animationId?: string }>,
) {
  return {
    id: 'consumable-0',
    effect: 'heal' as const,
    animationId: 'fx.self.healing-pulse',
    playerPos: { x: 5, y: 5 },
    blastPositions: [],
    durationMs: 700,
    presentation: {
      kind: 'heal_hearts' as const,
      durationMs: 700,
    },
    startTime: Date.now(),
    progress: 0.3,
    ...overrides,
  };
}

/** Minimal active AbilityAnimationEntry. */
function makeFxAnimation(
  overrides?: Partial<AbilityAnimationEntry & { id: string; startTime: number; progress: number }>,
) {
  return {
    id: 'fx-0',
    abilityId: 'fireball',
    animationId: 'fx.self.healing-pulse',
    playerPos: { x: 5, y: 5 },
    blastPositions: [],
    durationMs: 500,
    impactFrameMs: 250,
    suppressActorBump: false,
    startTime: Date.now(),
    progress: 0.5,
    ...overrides,
  };
}

/** Minimal StatusPresentationView. */
function makeStatusPresentation(overrides?: Partial<StatusPresentationView>): StatusPresentationView {
  return {
    entityScale: 1.25,
    ...overrides,
  };
}

/** Default props that produce a visible overlay (flag on, map present, animation active). */
function makeDefaultProps(): ThreeEffectsOverlayProps {
  return {
    map: makeMap(),
    isEnabled: true,
    consumableAnimations: [makeConsumableAnimation()] as any,
    fxAnimations: [] as any,
    statusPresentations: [] as StatusPresentationView[],
    vpTilesWidth: 30,
    vpTilesHeight: 22,
    vpLeft: 0,
    vpTop: 0,
    cameraOffset: { x: 0, y: 0 },
    createRenderer: mockCreateRenderer as any,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the canvas rendered inside `container`, or null. */
function getCanvas(container: HTMLElement): HTMLCanvasElement | null {
  return container.querySelector('canvas');
}

// ---------------------------------------------------------------------------
// Suite 1: Flag-off behavior
// ---------------------------------------------------------------------------

describe('ThreeEffectsOverlay — flag disabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when isEnabled is false', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        isEnabled={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('does not create a renderer when isEnabled is false', () => {
    render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        isEnabled={false}
      />,
    );
    expect(mockCreateRenderer).not.toHaveBeenCalled();
  });

  it('does not render any DOM nodes when isEnabled is false', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        isEnabled={false}
      />,
    );
    expect(container.childElementCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Map null handling
// ---------------------------------------------------------------------------

describe('ThreeEffectsOverlay — null map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when map is null', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        map={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('does not create a renderer when map is null', () => {
    render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        map={null}
      />,
    );
    expect(mockCreateRenderer).not.toHaveBeenCalled();
  });

  it('renders null for null map even when animations are present', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        map={null}
        consumableAnimations={[makeConsumableAnimation()]}
        fxAnimations={[makeFxAnimation()]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: No active animations
// ---------------------------------------------------------------------------

describe('ThreeEffectsOverlay — no active animations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when both consumable and fx animation arrays are empty', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[]}
        fxAnimations={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('does not create a renderer when animation arrays are empty', () => {
    render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[]}
        fxAnimations={[]}
      />,
    );
    expect(mockCreateRenderer).not.toHaveBeenCalled();
  });

  it('renders null when consumableAnimations is empty and fxAnimations is empty', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[]}
        fxAnimations={[]}
      />,
    );
    expect(getCanvas(container)).toBeNull();
  });

  it('renders canvas when only consumableAnimations has entries (fxAnimations empty)', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[makeConsumableAnimation()]}
        fxAnimations={[]}
      />,
    );
    expect(getCanvas(container)).not.toBeNull();
  });

  it('renders canvas when only fxAnimations has entries (consumableAnimations empty)', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[]}
        fxAnimations={[makeFxAnimation()]}
      />,
    );
    expect(getCanvas(container)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 4: WebGL setup failure
// ---------------------------------------------------------------------------

describe('ThreeEffectsOverlay — WebGL setup failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a canvas but with no active renderer when renderer creation throws', () => {
    mockCreateRenderer.mockImplementationOnce(() => {
      throw new Error('WebGL not supported');
    });

    const { container } = render(
      <ThreeEffectsOverlay {...makeDefaultProps()} />,
    );

    expect(getCanvas(container)).not.toBeNull();
  });

  it('does not propagate the error when renderer creation fails', () => {
    mockCreateRenderer.mockImplementationOnce(() => {
      throw new Error('WebGL context creation failed');
    });

    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} />);
    }).not.toThrow();
  });

  it('renders a canvas but with no renderer when renderer creation returns null', () => {
    mockCreateRenderer.mockReturnValueOnce(null as any);

    const { container } = render(
      <ThreeEffectsOverlay {...makeDefaultProps()} />,
    );

    expect(getCanvas(container)).not.toBeNull();
  });

  it('renders a canvas but with no renderer when renderer creation returns undefined', () => {
    mockCreateRenderer.mockReturnValueOnce(undefined as any);

    const { container } = render(
      <ThreeEffectsOverlay {...makeDefaultProps()} />,
    );

    expect(getCanvas(container)).not.toBeNull();
  });

  it('falls back gracefully after a failed render attempt on subsequent renders', () => {
    mockCreateRenderer.mockImplementationOnce(() => {
      throw new Error('WebGL not supported');
    });

    // First render — renderer creation fails, but canvas renders
    const { container, rerender } = render(
      <ThreeEffectsOverlay {...makeDefaultProps()} />,
    );
    expect(getCanvas(container)).not.toBeNull();

    // Reset mock so next attempt can succeed
    vi.clearAllMocks();

    // Second render — should not throw regardless of prior failure
    expect(() => {
      rerender(<ThreeEffectsOverlay {...makeDefaultProps()} />);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Successful render — canvas properties
// ---------------------------------------------------------------------------

describe('ThreeEffectsOverlay — successful render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a canvas element when flag is on, map is present, and animations are active', () => {
    const { container } = render(
      <ThreeEffectsOverlay {...makeDefaultProps()} />,
    );
    expect(getCanvas(container)).not.toBeNull();
  });

  it('canvas has pointer-events: none so it does not block map interaction', () => {
    const { container } = render(
      <ThreeEffectsOverlay {...makeDefaultProps()} />,
    );
    const canvas = getCanvas(container);
    expect(canvas).not.toBeNull();
    expect(canvas!.style.pointerEvents).toBe('none');
  });

  it('canvas has position: absolute so it layers over the dungeon canvas', () => {
    const { container } = render(
      <ThreeEffectsOverlay {...makeDefaultProps()} />,
    );
    const canvas = getCanvas(container);
    expect(canvas).not.toBeNull();
    expect(canvas!.style.position).toBe('absolute');
  });

  it('canvas width matches vpTilesWidth * CELL_SIZE', () => {
    const vpTilesWidth = 30;
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        vpTilesWidth={vpTilesWidth}
      />,
    );
    const canvas = getCanvas(container);
    expect(canvas).not.toBeNull();
    // Accept either the canvas attribute or a computed style value
    const expectedPx = vpTilesWidth * CELL_SIZE;
    const widthMatches =
      canvas!.width === expectedPx ||
      canvas!.style.width === `${expectedPx}px`;
    expect(widthMatches).toBe(true);
  });

  it('canvas height matches vpTilesHeight * CELL_SIZE', () => {
    const vpTilesHeight = 22;
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        vpTilesHeight={vpTilesHeight}
      />,
    );
    const canvas = getCanvas(container);
    expect(canvas).not.toBeNull();
    const expectedPx = vpTilesHeight * CELL_SIZE;
    const heightMatches =
      canvas!.height === expectedPx ||
      canvas!.style.height === `${expectedPx}px`;
    expect(heightMatches).toBe(true);
  });

  it('canvas dimensions scale correctly with a different vpTilesWidth', () => {
    const vpTilesWidth = 20;
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        vpTilesWidth={vpTilesWidth}
      />,
    );
    const canvas = getCanvas(container);
    expect(canvas).not.toBeNull();
    const expectedPx = vpTilesWidth * CELL_SIZE;
    const widthMatches =
      canvas!.width === expectedPx ||
      canvas!.style.width === `${expectedPx}px`;
    expect(widthMatches).toBe(true);
  });

  it('canvas dimensions scale correctly with a different vpTilesHeight', () => {
    const vpTilesHeight = 15;
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        vpTilesHeight={vpTilesHeight}
      />,
    );
    const canvas = getCanvas(container);
    expect(canvas).not.toBeNull();
    const expectedPx = vpTilesHeight * CELL_SIZE;
    const heightMatches =
      canvas!.height === expectedPx ||
      canvas!.style.height === `${expectedPx}px`;
    expect(heightMatches).toBe(true);
  });

  it('renderer is created when all conditions are met', () => {
    render(<ThreeEffectsOverlay {...makeDefaultProps()} />);
    expect(mockCreateRenderer).toHaveBeenCalled();
  });

  it('canvas remains when only consumable animations are active', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[makeConsumableAnimation()]}
        fxAnimations={[]}
      />,
    );
    expect(getCanvas(container)).not.toBeNull();
  });

  it('canvas remains when only fx animations are active', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[]}
        fxAnimations={[makeFxAnimation()]}
      />,
    );
    expect(getCanvas(container)).not.toBeNull();
  });

  it('canvas remains when both consumable and fx animations are active simultaneously', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[makeConsumableAnimation()]}
        fxAnimations={[makeFxAnimation()]}
      />,
    );
    expect(getCanvas(container)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Props interface contract
// ---------------------------------------------------------------------------

describe('ThreeEffectsOverlay — props interface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a MapView as the map prop', () => {
    const map = makeMap({ width: 20, height: 15 });
    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} map={map} />);
    }).not.toThrow();
  });

  it('accepts null as the map prop', () => {
    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} map={null} />);
    }).not.toThrow();
  });

  it('accepts a boolean for isEnabled', () => {
    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} isEnabled={true} />);
    }).not.toThrow();
    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} isEnabled={false} />);
    }).not.toThrow();
  });

  it('accepts an array of consumable animations', () => {
    const animations = [makeConsumableAnimation(), makeConsumableAnimation({ id: 'consumable-1' })];
    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} consumableAnimations={animations} />);
    }).not.toThrow();
  });

  it('accepts an empty consumableAnimations array', () => {
    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} consumableAnimations={[]} />);
    }).not.toThrow();
  });

  it('accepts an array of fx animations', () => {
    const animations = [makeFxAnimation(), makeFxAnimation({ id: 'fx-1' })];
    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} fxAnimations={animations} />);
    }).not.toThrow();
  });

  it('accepts an empty fxAnimations array', () => {
    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} fxAnimations={[]} />);
    }).not.toThrow();
  });

  it('accepts statusPresentations array', () => {
    const statuses = [makeStatusPresentation(), makeStatusPresentation({ entityScale: 1.4 })];
    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} statusPresentations={statuses} />);
    }).not.toThrow();
  });

  it('accepts an empty statusPresentations array', () => {
    expect(() => {
      render(<ThreeEffectsOverlay {...makeDefaultProps()} statusPresentations={[]} />);
    }).not.toThrow();
  });

  it('accepts numeric vpTilesWidth and vpTilesHeight', () => {
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          vpTilesWidth={25}
          vpTilesHeight={18}
        />,
      );
    }).not.toThrow();
  });

  it('accepts vpLeft and vpTop viewport origin props', () => {
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          vpLeft={5}
          vpTop={3}
        />,
      );
    }).not.toThrow();
  });

  it('accepts vpLeft and vpTop of zero', () => {
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          vpLeft={0}
          vpTop={0}
        />,
      );
    }).not.toThrow();
  });

  it('accepts a cameraOffset with x and y components', () => {
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          cameraOffset={{ x: 8, y: -4 }}
        />,
      );
    }).not.toThrow();
  });

  it('accepts a cameraOffset of { x: 0, y: 0 }', () => {
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          cameraOffset={{ x: 0, y: 0 }}
        />,
      );
    }).not.toThrow();
  });

  it('accepts a negative cameraOffset (camera panned left/up)', () => {
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          cameraOffset={{ x: -16, y: -8 }}
        />,
      );
    }).not.toThrow();
  });

  it('accepts a createRenderer factory override (test seam)', () => {
    const customFactory = vi.fn(() => {
      const canvas = document.createElement('canvas');
      return { setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(), domElement: canvas, scene: {} as any, camera: {} as any };
    });

    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          createRenderer={customFactory}
        />,
      );
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Suite 7: Renderer lifecycle
// ---------------------------------------------------------------------------

describe('ThreeEffectsOverlay — renderer lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls renderer.dispose() when the component unmounts', () => {
    const { unmount } = render(<ThreeEffectsOverlay {...makeDefaultProps()} />);
    unmount();
    expect(mockRenderer.dispose).toHaveBeenCalled();
  });

  it('does not call renderer.dispose() if renderer was never created (flag off)', () => {
    const { unmount } = render(
      <ThreeEffectsOverlay {...makeDefaultProps()} isEnabled={false} />,
    );
    unmount();
    expect(mockRenderer.dispose).not.toHaveBeenCalled();
  });

  it('does not call renderer.dispose() if renderer was never created (no map)', () => {
    const { unmount } = render(
      <ThreeEffectsOverlay {...makeDefaultProps()} map={null} />,
    );
    unmount();
    expect(mockRenderer.dispose).not.toHaveBeenCalled();
  });

  it('transitions from no-canvas to canvas when animations become active', () => {
    const { container, rerender } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[]}
        fxAnimations={[]}
      />,
    );

    // Initially no canvas — no active animations
    expect(getCanvas(container)).toBeNull();

    // Simulate animation starting
    rerender(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[makeConsumableAnimation()]}
        fxAnimations={[]}
      />,
    );

    expect(getCanvas(container)).not.toBeNull();
  });

  it('transitions from canvas to no-canvas when animations all finish', () => {
    const { container, rerender } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[makeConsumableAnimation()]}
        fxAnimations={[]}
      />,
    );

    // Canvas is present while animation active
    expect(getCanvas(container)).not.toBeNull();

    vi.clearAllMocks();

    // Animation finishes — both arrays empty
    rerender(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        consumableAnimations={[]}
        fxAnimations={[]}
      />,
    );

    expect(getCanvas(container)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite 8: Edge cases
// ---------------------------------------------------------------------------

describe('ThreeEffectsOverlay — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when all three guard conditions fail simultaneously', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        isEnabled={false}
        map={null}
        consumableAnimations={[]}
        fxAnimations={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null when flag is on but map is null and no animations', () => {
    const { container } = render(
      <ThreeEffectsOverlay
        {...makeDefaultProps()}
        isEnabled={true}
        map={null}
        consumableAnimations={[]}
        fxAnimations={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('handles a vpTilesWidth of 1 without throwing', () => {
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          vpTilesWidth={1}
          vpTilesHeight={1}
        />,
      );
    }).not.toThrow();
  });

  it('handles a large viewport (100×100 tiles) without throwing', () => {
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          vpTilesWidth={100}
          vpTilesHeight={100}
        />,
      );
    }).not.toThrow();
  });

  it('handles many simultaneous consumable animations without throwing', () => {
    const animations = Array.from({ length: 20 }, (_, i) =>
      makeConsumableAnimation({ id: `consumable-${i}` }),
    );
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          consumableAnimations={animations}
        />,
      );
    }).not.toThrow();
  });

  it('handles many simultaneous fx animations without throwing', () => {
    const animations = Array.from({ length: 20 }, (_, i) =>
      makeFxAnimation({ id: `fx-${i}` }),
    );
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          fxAnimations={animations}
        />,
      );
    }).not.toThrow();
  });

  it('handles a large positive camera offset without throwing', () => {
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          cameraOffset={{ x: 9999, y: 9999 }}
        />,
      );
    }).not.toThrow();
  });

  it('handles a large negative camera offset without throwing', () => {
    expect(() => {
      render(
        <ThreeEffectsOverlay
          {...makeDefaultProps()}
          cameraOffset={{ x: -9999, y: -9999 }}
        />,
      );
    }).not.toThrow();
  });

  it('is stable across multiple rapid re-renders with unchanged props', () => {
    const props = makeDefaultProps();
    const { rerender } = render(<ThreeEffectsOverlay {...props} />);

    expect(() => {
      for (let i = 0; i < 10; i++) {
        rerender(<ThreeEffectsOverlay {...props} />);
      }
    }).not.toThrow();
  });
});
