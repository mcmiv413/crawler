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
import { render, waitFor } from '@testing-library/react';
import { entityId, type EntityId } from '@dungeon/contracts';
import type { EntityView, MapView, ConsumableAnimationEntry } from '@dungeon/presenter';

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
  mockCreateAtmosphereVignette,
  mockAtmosphereVignette,
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
    animationId === 'fx.self.healing-pulse'
      || animationId === 'fx.status.gold-ring-pulse'
      || animationId === 'fx.status.heat-surge-ring'
      || animationId === 'fx.status.arcane-charge-ring'
      ? mockAnimationModule
      : undefined,
  );

  const mockAtmosphereVignette = {
    object: { tag: 'atmosphere-vignette' },
    material: {},
    texture: null,
    setSize: vi.fn(),
    setOpacity: vi.fn(),
    dispose: vi.fn(),
  };

  const mockCreateAtmosphereVignette = vi.fn(() => mockAtmosphereVignette);

  return {
    mockCreateRenderer,
    mockRenderer,
    mockAnimationModule,
    mockGetAnimationModule,
    mockCreateAtmosphereVignette,
    mockAtmosphereVignette,
  };
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

vi.mock('./lib/atmosphere-plane.js', () => ({
  createAtmosphereVignette: mockCreateAtmosphereVignette,
}));

// ---------------------------------------------------------------------------
// Deferred import after mocks are wired
// ---------------------------------------------------------------------------

import {
  ThreeAnimationOverlay,
  getStatusPresentationEntityScale,
  resolveHandledModuleAnimations,
  resolveThreeOwnedEntityIds,
} from './ThreeAnimationOverlay.js';
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

function makeEntity(id = 'enemy-1', overrides?: Partial<EntityView>): EntityView {
  return {
    id,
    x: 5,
    y: 5,
    ascii: 'g',
    color: '#55ff55',
    name: 'Goblin',
    type: 'enemy',
    templateId: 'goblin',
    ...overrides,
  };
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

function makeMoveAnimation(overrides?: Record<string, unknown>) {
  return {
    id: 'move-0',
    entityId: 'enemy-1',
    fromPos: { x: 4, y: 5 },
    toPos: { x: 5, y: 5 },
    style: 'step',
    durationMs: 120,
    startTime: Date.now(),
    progress: 0.4,
    fromOffsetPx: { x: 0, y: 0 },
    ...overrides,
  } as any;
}

function makeBumpAnimation(overrides?: Record<string, unknown>) {
  return {
    id: 'bump-0',
    attackerId: 'enemy-1',
    defenderId: 'player-1',
    attackerPos: { x: 5, y: 5 },
    defenderPos: { x: 6, y: 5 },
    durationMs: 300,
    impactFrameMs: 150,
    startTime: Date.now(),
    progress: 0.5,
    ...overrides,
  } as any;
}

function makeDefaultProps(overrides?: Partial<ThreeAnimationOverlayProps>): ThreeAnimationOverlayProps {
  return {
    map: makeMap(),
    isEnabled: true,
    vpTilesWidth: 20,
    vpTilesHeight: 15,
    bumpAnimations: [],
    moveAnimations: [],
    consumableAnimations: [],
    fxAnimations: [],
    statusPresentations: [],
    combatIndicators: [],
    defenderHits: new Map(),
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
  mockCreateAtmosphereVignette.mockClear();
  mockAtmosphereVignette.setSize.mockClear();
  mockAtmosphereVignette.setOpacity.mockClear();
  mockAtmosphereVignette.dispose.mockClear();
  // Restore default behaviour
  mockCreateRenderer.mockImplementation((_canvas: HTMLCanvasElement): typeof mockRenderer | null => {
    mockRenderer.domElement = document.createElement('canvas');
    return mockRenderer;
  });
  mockGetAnimationModule.mockImplementation((id: string) =>
    id === 'fx.self.healing-pulse'
      || id === 'fx.status.gold-ring-pulse'
      || id === 'fx.status.heat-surge-ring'
      || id === 'fx.status.arcane-charge-ring'
      ? mockAnimationModule
      : undefined,
  );
  mockCreateAtmosphereVignette.mockImplementation(() => mockAtmosphereVignette);
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
    expect(mockCreateAtmosphereVignette).not.toHaveBeenCalled();
  });

  it('renders null when no active visuals are present and atmosphereEnabled=false', () => {
    const { queryByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [],
          fxAnimations: [],
          atmosphereEnabled: false,
        })}
      />,
    );
    expect(queryByTestId('three-animation-overlay')).toBeNull();
    expect(mockCreateAtmosphereVignette).not.toHaveBeenCalled();
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

  it('renders canvas when moveAnimations owns a visible entity', () => {
    const { getByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          map: makeMap({ entities: [makeEntity()] }),
          moveAnimations: [makeMoveAnimation()],
        })}
      />,
    );
    expect(getByTestId('three-animation-overlay')).toBeTruthy();
  });

  it('renders canvas when atmosphereEnabled=true without other active visuals', () => {
    const { getByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [],
          fxAnimations: [],
          atmosphereEnabled: true,
        })}
      />,
    );
    expect(getByTestId('three-animation-overlay')).toBeTruthy();
  });

  it('renders canvas when defenderHits has an active visible entity', () => {
    const defenderHits = new Map<EntityId, { startTime: number; durationMs: number }>([[
      entityId('enemy-1'),
      { startTime: Date.now(), durationMs: 250 },
    ]]);
    const { getByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          map: makeMap({ entities: [makeEntity()] }),
          defenderHits,
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

  it('creates and resizes the atmosphere vignette when atmosphereEnabled=true', async () => {
    render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [],
          fxAnimations: [],
          atmosphereEnabled: true,
        })}
      />,
    );

    expect(mockCreateAtmosphereVignette).toHaveBeenCalledWith({
      width: 20 * CELL_SIZE,
      height: 15 * CELL_SIZE,
    });
    expect(mockRenderer.scene.add).toHaveBeenCalledWith(mockAtmosphereVignette.object);
    await waitFor(() => {
      expect(mockAtmosphereVignette.setSize).toHaveBeenCalledWith(20 * CELL_SIZE, 15 * CELL_SIZE);
    });
  });

  it('disposes the atmosphere vignette cleanly when atmosphereEnabled flips off', () => {
    const { rerender, queryByTestId } = render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [],
          fxAnimations: [],
          atmosphereEnabled: true,
        })}
      />,
    );

    expect(queryByTestId('three-animation-overlay')).toBeTruthy();
    expect(mockRenderer.scene.add).toHaveBeenCalledWith(mockAtmosphereVignette.object);

    rerender(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          consumableAnimations: [],
          fxAnimations: [],
          atmosphereEnabled: false,
        })}
      />,
    );

    expect(queryByTestId('three-animation-overlay')).toBeNull();
    expect(mockRenderer.scene.remove).toHaveBeenCalledWith(mockAtmosphereVignette.object);
    expect(mockAtmosphereVignette.dispose).toHaveBeenCalledTimes(1);
    expect(mockRenderer.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('ThreeAnimationOverlay – ownership helpers', () => {
  beforeEach(resetMocks);

  it('fans out blast positions for module-backed fx animations', () => {
    const resolved = resolveHandledModuleAnimations(
      makeMap(),
      [],
      [makeFxAnimation({
        blastPositions: [
          { x: 4, y: 4 },
          { x: 5, y: 4 },
          { x: 6, y: 4 },
        ],
      })],
      [],
      mockGetAnimationModule,
    );

    expect(resolved.map((entry) => entry.position)).toEqual([
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
    ]);
  });

  it('uses targetPos when no blast positions are present', () => {
    const resolved = resolveHandledModuleAnimations(
      makeMap(),
      [],
      [makeFxAnimation({
        targetPos: { x: 8, y: 3 },
        blastPositions: [],
      })],
      [],
      mockGetAnimationModule,
    );

    expect(resolved[0]?.position).toEqual({ x: 8, y: 3 });
  });

  it('passes projectile source and target positions through the overlay bridge', () => {
    const resolved = resolveHandledModuleAnimations(
      makeMap(),
      [],
      [makeFxAnimation({
        animationId: 'fx.projectile.ember-bolt' as any,
        playerPos: { x: 2, y: 3 },
        targetPos: { x: 8, y: 3 },
        blastPositions: [],
      })],
      [],
      () => mockAnimationModule,
    );

    expect(resolved[0]?.sourcePosition).toEqual({ x: 2, y: 3 });
    expect(resolved[0]?.targetPosition).toEqual({ x: 8, y: 3 });
  });

  it('uses each blast position as the projectile target when multiple targets are resolved', () => {
    const resolved = resolveHandledModuleAnimations(
      makeMap(),
      [],
      [makeFxAnimation({
        animationId: 'fx.projectile.arrow-volley' as any,
        playerPos: { x: 2, y: 3 },
        targetPos: { x: 8, y: 3 },
        blastPositions: [{ x: 6, y: 2 }, { x: 7, y: 4 }],
      })],
      [],
      () => mockAnimationModule,
    );

    expect(resolved.map((entry) => entry.sourcePosition)).toEqual([
      { x: 2, y: 3 },
      { x: 2, y: 3 },
    ]);
    expect(resolved.map((entry) => entry.targetPosition)).toEqual([
      { x: 6, y: 2 },
      { x: 7, y: 4 },
    ]);
  });

  it('reports visible moving and bumping entities as Three-owned', () => {
    const owned = resolveThreeOwnedEntityIds(
      makeMap({ entities: [makeEntity()] }),
      [makeMoveAnimation()],
      [makeBumpAnimation()],
    );

    expect(owned).toEqual(['enemy-1']);
  });

  it('reports the visible player entity as Three-owned when status presentations move to Three', () => {
    const owned = resolveThreeOwnedEntityIds(
      makeMap({
        entities: [makeEntity('player-1', {
          type: 'player',
          templateId: null,
          ascii: '@',
          color: '#ffffff',
          name: 'Hero',
        })],
      }),
      [],
      [],
      true,
    );

    expect(owned).toEqual(['player-1']);
  });

  it('uses the largest active status entity scale for player presentation ownership', () => {
    expect(getStatusPresentationEntityScale([
      { animationId: 'fx.status.arcane-charge-ring', entityScale: 1.18 },
      { animationId: 'fx.status.gold-ring-pulse', entityScale: 1.35 },
    ])).toBe(1.35);
  });
});

describe('ThreeAnimationOverlay – ownership callback', () => {
  beforeEach(resetMocks);

  it('reports entityIds when moveAnimations are active', async () => {
    const onOwnershipChange = vi.fn();
    render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          map: makeMap({ entities: [makeEntity()] }),
          moveAnimations: [makeMoveAnimation()],
          onOwnershipChange,
        })}
      />,
    );

    await waitFor(() => {
      expect(onOwnershipChange).toHaveBeenCalledWith(expect.objectContaining({
        entityIds: ['enemy-1'],
      }));
    });
  });

  it('reports status ownership and the player entity when status presentations are active', async () => {
    const onOwnershipChange = vi.fn();
    render(
      <ThreeAnimationOverlay
        {...makeDefaultProps({
          map: makeMap({
            entities: [makeEntity('player-1', {
              type: 'player',
              templateId: null,
              ascii: '@',
              color: '#ffffff',
              name: 'Hero',
            })],
          }),
          statusPresentations: [
            {
              animationId: 'fx.status.gold-ring-pulse',
              entityScale: 1.35,
              ring: {
                colorRgb: '255, 200, 0',
                alphaBase: 0.35,
                alphaAmplitude: 0.45,
                pulsePeriodMs: 180,
                lineWidth: 1.5,
                paddingPx: 2,
              },
            },
          ],
          onOwnershipChange,
        })}
      />,
    );

    await waitFor(() => {
      expect(onOwnershipChange).toHaveBeenCalledWith(expect.objectContaining({
        entityIds: ['player-1'],
        statusPresentation: true,
      }));
    });
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
