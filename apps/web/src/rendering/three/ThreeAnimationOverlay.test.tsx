/**
 * Tests for ThreeAnimationOverlay React component (Workstream 2).
 *
 * ThreeAnimationOverlay is the generalized replacement for ThreeEffectsOverlay.
 * It uses the three-animation-registry (ThreeAnimationModule with id + category)
 * instead of the narrower three-effect-registry.
 *
 * Key behavioral contracts:
 *  - Mounts a canvas with data-testid="three-animation-overlay"
 *  - Renders null when isEnabled=false, map=null, or no active animations
 *  - Renders null when WebGL factory returns null (failure path)
 *  - Calls onInitialized([]) on failure or no active animations
 *  - Calls onInitialized(animationIds) after successful renderer init
 *  - Resolves modules from three-animation-registry, not three-effect-registry
 *  - Canvas is pointer-events:none so it never intercepts dungeon clicks
 *  - Renderer is disposed on unmount
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { MapView, ConsumableAnimationEntry } from '@dungeon/presenter';

// Mirror the ActiveConsumableAnimation shape from useConsumableAnimationState.
// Tests must not import from the hook directly to stay within test-file tsconfig scope.
interface ActiveConsumableAnimation extends ConsumableAnimationEntry {
  id: string;
  startTime: number;
  progress: number;
}

// ---------------------------------------------------------------------------
// Fixed constants — must NOT import from ui-config
// ---------------------------------------------------------------------------
const CELL_SIZE = 24;

// ---------------------------------------------------------------------------
// Hoisted mocks: renderer factory + animation registry
// ---------------------------------------------------------------------------

const {
  mockCreateRenderer,
  mockRenderer,
  mockAnimationModule,
  mockGetAnimationModule,
} = vi.hoisted(() => {
  const mockRenderer = {
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: null as HTMLCanvasElement | null,
    scene: { add: vi.fn(), remove: vi.fn() } as any,
    camera: {
      left: 0, right: 0, top: 0, bottom: 0,
      updateProjectionMatrix: vi.fn(),
    } as any,
  };

  const mockCreateRenderer = vi.fn((_canvas: HTMLCanvasElement): typeof mockRenderer | null => {
    mockRenderer.domElement = document.createElement('canvas');
    return mockRenderer;
  });

  const mockAnimationModule = {
    id: 'fx.self.healing-pulse' as any,
    category: 'self' as any,
    create: vi.fn(() => ({ tag: 'inst-0' })),
    setPosition: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  };

  const mockGetAnimationModule = vi.fn((animationId: string) =>
    animationId === 'fx.self.healing-pulse' ? mockAnimationModule : undefined,
  );

  return { mockCreateRenderer, mockRenderer, mockAnimationModule, mockGetAnimationModule };
});

vi.mock('./three-renderer-factory.js', () => ({
  createThreeRenderer: mockCreateRenderer,
}));

vi.mock('./three-animation-registry.js', () => ({
  getAnimationModule: mockGetAnimationModule,
  registerAnimationModule: vi.fn(),
  listAnimationIds: vi.fn(() => []),
  resetForTesting: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Deferred import after mocks are wired
// ---------------------------------------------------------------------------

import { ThreeAnimationOverlay } from './ThreeAnimationOverlay.js';
import type { ThreeAnimationOverlayProps } from './ThreeAnimationOverlay.js';

// ---------------------------------------------------------------------------
// Fixture factories — use ActiveConsumableAnimation (has id, startTime, progress)
// ---------------------------------------------------------------------------

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
  } as unknown as MapView;
}

function makeConsumableAnimation(
  overrides?: Partial<ActiveConsumableAnimation>,
): ActiveConsumableAnimation {
  return {
    id: 'consumable-0',
    effect: 'heal' as const,
    animationId: 'fx.self.healing-pulse' as any,
    playerPos: { x: 5, y: 5 },
    blastPositions: [],
    durationMs: 700,
    presentation: { kind: 'heal_hearts' as const, durationMs: 700 },
    startTime: Date.now(),
    progress: 0.3,
    ...overrides,
  } as unknown as ActiveConsumableAnimation;
}

// ActiveFxAnimation is not exported from the hook; build inline with required shape
function makeFxAnimation(overrides?: Record<string, unknown>) {
  return {
    id: 'fx-0',
    abilityId: 'fireball',
    animationId: 'fx.self.healing-pulse' as any,
    playerPos: { x: 5, y: 5 },
    blastPositions: [],
    durationMs: 500,
    startTime: Date.now(),
    progress: 0.3,
    ...overrides,
  } as any;
}

function makeDefaultProps(overrides?: Partial<ThreeAnimationOverlayProps>): ThreeAnimationOverlayProps {
  return {
    map: makeMap(),
    isEnabled: true,
    vpTilesWidth: 20,
    vpTilesHeight: 15,
    consumableAnimations: [],
    fxAnimations: [],
    statusPresentations: [],
    vpLeft: 0,
    vpTop: 0,
    cameraOffset: { x: 0, y: 0 },
    createRenderer: mockCreateRenderer as any,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  mockCreateRenderer.mockClear();
  mockRenderer.setSize.mockClear();
  mockRenderer.render.mockClear();
  mockRenderer.dispose.mockClear();
  mockRenderer.scene.add.mockClear();
  mockRenderer.scene.remove.mockClear();
  mockRenderer.camera.updateProjectionMatrix.mockClear();
  mockAnimationModule.create.mockClear();
  mockAnimationModule.setPosition.mockClear();
  mockAnimationModule.update.mockClear();
  mockAnimationModule.dispose.mockClear();
  mockGetAnimationModule.mockClear();
  // Restore default behaviour
  mockCreateRenderer.mockImplementation((_canvas: HTMLCanvasElement): typeof mockRenderer | null => {
    mockRenderer.domElement = document.createElement('canvas');
    return mockRenderer;
  });
  mockGetAnimationModule.mockImplementation((id: string) =>
    id === 'fx.self.healing-pulse' ? mockAnimationModule : undefined,
  );
}

// ---------------------------------------------------------------------------
// Suite: canvas identity
// ---------------------------------------------------------------------------

describe('ThreeAnimationOverlay – canvas identity', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.clearAllTimers());

  it('mounts canvas with data-testid="three-animation-overlay"', () => {
    const { getByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    expect(getByTestId('three-animation-overlay')).toBeTruthy();
  });

  it('canvas has pointer-events:none style', () => {
    const { getByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    const canvas = getByTestId('three-animation-overlay') as HTMLCanvasElement;
    expect(canvas.style.pointerEvents).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Suite: render gating
// ---------------------------------------------------------------------------

describe('ThreeAnimationOverlay – render gating', () => {
  beforeEach(resetMocks);

  it('renders null when isEnabled=false', () => {
    const { queryByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          isEnabled: false,
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    expect(queryByTestId('three-animation-overlay')).toBeNull();
  });

  it('renders null when map=null', () => {
    const { queryByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          map: null,
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    expect(queryByTestId('three-animation-overlay')).toBeNull();
  });

  it('renders null when no active animations are present', () => {
    const { queryByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [],
          fxAnimations: [],
        })}
      />,
    );
    expect(queryByTestId('three-animation-overlay')).toBeNull();
  });

  it('renders null when active animations have no registered module', () => {
    mockGetAnimationModule.mockReturnValue(undefined);
    const { queryByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation({ animationId: 'fx.impact.unknown' as any })],
        })}
      />,
    );
    expect(queryByTestId('three-animation-overlay')).toBeNull();
  });

  it('renders null when WebGL factory returns null (failure)', () => {
    mockCreateRenderer.mockReturnValue(null);
    const { queryByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    expect(queryByTestId('three-animation-overlay')).toBeNull();
  });

  it('renders canvas when isEnabled=true, map present, and active animation has a module', () => {
    const { getByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    expect(getByTestId('three-animation-overlay')).toBeTruthy();
  });

  it('renders canvas when fxAnimations has an active animation with a registered module', () => {
    const { getByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          fxAnimations: [makeFxAnimation()],
        })}
      />,
    );
    expect(getByTestId('three-animation-overlay')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Suite: onInitialized callback
// ---------------------------------------------------------------------------

describe('ThreeAnimationOverlay – onInitialized', () => {
  beforeEach(resetMocks);

  it('calls onInitialized([]) when isEnabled=false', () => {
    const onInitialized = vi.fn();
    render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          isEnabled: false,
          consumableAnimations: [makeConsumableAnimation()],
          onInitialized,
        })}
      />,
    );
    expect(onInitialized).toHaveBeenCalledWith([]);
  });

  it('calls onInitialized([]) when WebGL factory fails', () => {
    mockCreateRenderer.mockReturnValue(null);
    const onInitialized = vi.fn();
    render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
          onInitialized,
        })}
      />,
    );
    expect(onInitialized).toHaveBeenCalledWith([]);
  });

  it('calls onInitialized with handled animation IDs after successful init', () => {
    const onInitialized = vi.fn();
    render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
          onInitialized,
        })}
      />,
    );
    expect(onInitialized).toHaveBeenCalledWith(
      expect.arrayContaining(['fx.self.healing-pulse']),
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: renderer lifecycle
// ---------------------------------------------------------------------------

describe('ThreeAnimationOverlay – renderer lifecycle', () => {
  beforeEach(resetMocks);

  it('calls createRenderer when canvas is mounted with active animations', () => {
    render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    expect(mockCreateRenderer).toHaveBeenCalledTimes(1);
  });

  it('calls renderer.dispose on unmount', () => {
    const { unmount } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    unmount();
    expect(mockRenderer.dispose).toHaveBeenCalledTimes(1);
  });

  it('calls renderer.setSize with correct pixel dimensions', () => {
    const vpTilesWidth = 20;
    const vpTilesHeight = 15;
    render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          vpTilesWidth,
          vpTilesHeight,
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    expect(mockRenderer.setSize).toHaveBeenCalledWith(
      vpTilesWidth * CELL_SIZE,
      vpTilesHeight * CELL_SIZE,
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: registry integration – uses ThreeAnimationModule not ThreeEffectModule
// ---------------------------------------------------------------------------

describe('ThreeAnimationOverlay – uses three-animation-registry', () => {
  beforeEach(resetMocks);

  it('calls getAnimationModule from three-animation-registry', () => {
    render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    expect(mockGetAnimationModule).toHaveBeenCalled();
  });

  it('does not render when animation module is not in registry', () => {
    mockGetAnimationModule.mockReturnValue(undefined);
    const { queryByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
        })}
      />,
    );
    expect(queryByTestId('three-animation-overlay')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite: canvas dimensions
// ---------------------------------------------------------------------------

describe('ThreeAnimationOverlay – canvas dimensions', () => {
  beforeEach(resetMocks);

  it('accepts a style prop and merges it onto canvas', () => {
    const { getByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [makeConsumableAnimation()],
          style: { zIndex: 5 },
        })}
      />,
    );
    const canvas = getByTestId('three-animation-overlay') as HTMLCanvasElement;
    expect(canvas.style.zIndex).toBe('5');
  });
});
