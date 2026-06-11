/**
 * DungeonPhase Component Tests — refactored for useDungeonRenderState hook
 * and Three overlay wiring.
 *
 * These tests are written FIRST (TDD RED phase).  The hook
 * `useDungeonRenderState`, the component `ThreeAnimationOverlay`, and the renderer
 * mode flag wiring do not yet exist; the tests will fail until the
 * implementation is added.
 *
 * Sections:
 *   1. Legacy DungeonPhase rendering (preserves existing coverage, keeps green)
 *   2. Flag-off – only DungeonCanvas rendered, no overlay
 *   3. Flag-on  – both DungeonCanvas and ThreeAnimationOverlay rendered as siblings
 *   4. Overlay pointer-events constraint
 *   5. Props flow – hook inputs match MapDisplay args; no animation duplication
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { GameView, AvailableAction, MapView } from '@dungeon/presenter';

// ---------------------------------------------------------------------------
// vi.hoisted – shared spy/state bags created before any vi.mock() factory runs
// ---------------------------------------------------------------------------
const {
  bumpAnimationState,
  moveAnimationState,
  consumableAnimationState,
  fxAnimationState,
  combatIndicatorState,
  defenderHitState,
  gameStoreSpy,
  dungeonRenderStateResult,
  displayMapState,
  animationRendererMode,
  depthAtmosphereEnabled,
  overlayLifecycleState,
} = vi.hoisted(() => ({
  bumpAnimationState: {
    current: [] as Array<{ id: string; attackerId: string; defenderId: string; attackerPos: { x: number; y: number }; defenderPos: { x: number; y: number }; durationMs: number; impactFrameMs: number; startTime: number; progress: number }>,
  },
  moveAnimationState: {
    current: [] as Array<{ id: string; entityId: string; fromPos: { x: number; y: number }; toPos: { x: number; y: number }; style: 'step'; progress: number; durationMs: number; startTime: number; fromOffsetPx: { x: number; y: number } }>,
  },
  consumableAnimationState: {
    current: [] as Array<{ id: string; effect: string; animationId?: string; playerPos: { x: number; y: number }; durationMs: number; startTime: number; progress: number }>,
  },
  fxAnimationState: {
    current: [] as Array<{ id: string; abilityId: string; animationId?: string; playerPos: { x: number; y: number }; durationMs: number; impactFrameMs: number; startTime: number; progress: number }>,
  },
  combatIndicatorState: {
    current: [] as Array<{
      id: string;
      x: number;
      y: number;
      text: string;
      type: 'damage' | 'heal' | 'status' | 'gold';
      startTime: number;
    }>,
  },
  defenderHitState: {
    current: new Map<string, { durationMs: number; startTime: number }>(),
  },
  gameStoreSpy: {
    statuses: [] as Array<{
      id: string;
      name: string;
      turnsRemaining: number;
      beneficial: boolean;
      presentation?: {
        animationId?: string;
        entityScale?: number;
        ring?: {
          colorRgb: string;
          alphaBase: number;
          alphaAmplitude: number;
          pulsePeriodMs: number;
          lineWidth: number;
          paddingPx: number;
        };
      };
    }>,
  },
  // Stores the last value returned by the mocked useDungeonRenderState so
  // individual tests can make assertions against it.
  dungeonRenderStateResult: {
    current: null as null | {
      displayMap: MapView;
      bumpAnimations: unknown[];
      moveAnimations: unknown[];
      consumableAnimations: unknown[];
      fxAnimations: unknown[];
      statusPresentations: unknown[];
      vpLeft: number;
      vpTop: number;
      cameraOffset: { x: number; y: number };
    },
  },
  displayMapState: {
    current: null as MapView | null,
  },
  animationRendererMode: { current: 'canvas' as 'canvas' | 'three' },
  depthAtmosphereEnabled: { current: false },
  overlayLifecycleState: {
    enabled: false,
    mountedIds: ['fx.self.healing-pulse'] as readonly string[],
    cleanupIds: [] as readonly string[],
    mountedOwnership: {
      animationIds: ['fx.self.healing-pulse'] as readonly string[],
      entityIds: [] as readonly string[],
      statusPresentation: false,
      combatIndicators: false,
    },
    cleanupOwnership: {
      animationIds: [] as readonly string[],
      entityIds: [] as readonly string[],
      statusPresentation: false,
      combatIndicators: false,
    },
  },
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../hooks/useBreakpoint.js', () => ({
  useBreakpoint: vi.fn(() => ({ isMobile: false })),
}));

vi.mock('../animation-runtime/useAnimationOrchestrator.js', () => ({
  useAnimationOrchestrator: vi.fn(),
}));

vi.mock('../hooks/useBumpAnimationState.js', () => ({
  useBumpAnimationState: () => ({ animations: bumpAnimationState.current }),
}));

vi.mock('../hooks/useMoveAnimationState.js', () => ({
  useMoveAnimationState: () => ({ animations: moveAnimationState.current }),
  resolveMoveAnimationProgress: (animation: unknown) => animation,
}));

vi.mock('../hooks/useConsumableAnimationState.js', () => ({
  useConsumableAnimationState: () => ({ animations: consumableAnimationState.current }),
}));

vi.mock('../hooks/useFxAnimationState.js', () => ({
  useFxAnimationState: () => ({ animations: fxAnimationState.current }),
}));

vi.mock('../hooks/useDefenderHitState.js', () => ({
  useDefenderHitState: () => defenderHitState.current,
}));

vi.mock('../hooks/useCombatIndicatorState.js', () => ({
  useCombatIndicatorState: () => combatIndicatorState.current,
}));

vi.mock('../store/game-store.js', () => ({
  useGameStore: Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => {
      const state = {
        view: {
          player: { statuses: gameStoreSpy.statuses },
          animatedEvents: [],
        },
      };
      return typeof selector === 'function' ? selector(state) : state;
    }),
    {
      getState: () => ({ startAutoWalk: vi.fn() }),
    },
  ),
}));

// The new hook that DungeonPhase will delegate render-state computation to.
// It wraps the four animation-state hooks + store status selector + viewport
// math.  In the RED phase this module does not exist yet — the mock makes the
// test tree parseable while asserting the expected contract.
vi.mock('../hooks/useDungeonRenderState.js', () => ({
  useDungeonRenderState: vi.fn(
    (
      _map: MapView,
      _vpTilesWidth: number,
      _vpTilesHeight: number,
    ) => {
      const result = {
        displayMap: displayMapState.current ?? _map,
        bumpAnimations: bumpAnimationState.current,
        moveAnimations: moveAnimationState.current,
        consumableAnimations: consumableAnimationState.current,
        fxAnimations: fxAnimationState.current,
        statusPresentations: gameStoreSpy.statuses
          .map((s) => s.presentation)
          .filter(Boolean),
        vpLeft: 0,
        vpTop: 0,
        cameraOffset: { x: 0, y: 0 },
      };
      dungeonRenderStateResult.current = result;
      return result;
    },
  ),
  findActivePlayerMove: () => undefined,
  getCameraOffsetForPlayerMove: () => ({ x: 0, y: 0 }),
  getViewportOriginForPosition: () => ({ x: 0, y: 0 }),
}));

// Renderer mode wiring for the Three overlay.
vi.mock('../config/feature-flags.js', () => ({
  isBeatSchedulerEnabledFlag: vi.fn(() => false),
  isDepthAtmosphereEnabledFlag: vi.fn(() => depthAtmosphereEnabled.current),
  isThreeEffectsEnabledFlag: vi.fn(() => animationRendererMode.current === 'three'),
  getAnimationRendererMode: vi.fn(() => animationRendererMode.current),
}));

// Canvas subsystem mocks (keep DungeonCanvas renderable in jsdom)
vi.mock('../sprites/sprite-registry.js', () => ({
  spriteRegistry: {
    isReady: () => true,
    onReady: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../sprites/canvas-renderer.js', () => ({
  renderMap: vi.fn(),
}));

vi.mock('../animations/generated/index.js', () => ({
  initializeAnimationModules: vi.fn(),
}));

vi.mock('../utils/pathfinding.js', () => ({
  findPath: vi.fn(() => []),
}));

// ThreeAnimationOverlay – mock to avoid WebGL in jsdom.  The mock renders a
// sentinel div so tests can confirm presence/absence without a real WebGL
// context.
vi.mock('./ThreeAnimationOverlay.js', () => ({
  ThreeAnimationOverlay: vi.fn(
    (props: {
      map: MapView;
      vpTilesWidth: number;
      vpTilesHeight: number;
      atmosphereEnabled?: boolean;
      bumpAnimations: unknown[];
      moveAnimations: unknown[];
      consumableAnimations: unknown[];
      fxAnimations: unknown[];
      statusPresentations: unknown[];
      combatIndicators: unknown[];
      defenderHits?: ReadonlyMap<string, { durationMs: number; startTime: number }>;
      vpLeft: number;
      vpTop: number;
      cameraOffset: { x: number; y: number };
      style?: React.CSSProperties;
      onInitialized?: (handledAnimationIds: readonly string[]) => void;
      onOwnershipChange?: (ownership: {
        animationIds: readonly string[];
        entityIds: readonly string[];
        statusPresentation: boolean;
        combatIndicators: boolean;
      }) => void;
    }) => {
      React.useEffect(() => {
        if (!overlayLifecycleState.enabled) {
          return;
        }

        props.onInitialized?.(overlayLifecycleState.mountedIds);
        props.onOwnershipChange?.(overlayLifecycleState.mountedOwnership);
        return () => {
          props.onInitialized?.(overlayLifecycleState.cleanupIds);
          props.onOwnershipChange?.(overlayLifecycleState.cleanupOwnership);
        };
      }, [props.onInitialized, props.onOwnershipChange]);

      return (
        <div
          data-testid="three-animation-overlay"
          data-vp-tiles-width={props.vpTilesWidth}
          data-vp-tiles-height={props.vpTilesHeight}
          data-atmosphere-enabled={props.atmosphereEnabled ?? false}
          data-vp-left={props.vpLeft}
          data-vp-top={props.vpTop}
          data-camera-offset-x={props.cameraOffset.x}
          data-camera-offset-y={props.cameraOffset.y}
          data-bump-count={props.bumpAnimations.length}
          data-move-count={props.moveAnimations.length}
          data-consumable-count={props.consumableAnimations.length}
          data-fx-count={props.fxAnimations.length}
          data-status-count={props.statusPresentations.length}
          data-combat-indicator-count={props.combatIndicators.length}
          data-defender-hit-count={props.defenderHits?.size ?? 0}
          style={props.style}
        />
      );
    },
  ),
}));

// ---------------------------------------------------------------------------
// Late imports (after mocks are registered)
// ---------------------------------------------------------------------------
import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { useDungeonRenderState } from '../hooks/useDungeonRenderState.js';
import { getAnimationRendererMode } from '../config/feature-flags.js';
import { renderMap } from '../sprites/canvas-renderer.js';
import { ThreeAnimationOverlay } from './ThreeAnimationOverlay.js';
import { DungeonPhase } from './DungeonPhase.js';

// ---------------------------------------------------------------------------
// Canvas stub – all describe blocks that render DungeonCanvas (useSprites:true)
// need a working getContext mock.  ItemSpriteIcon also calls clearRect/drawImage
// so the stub must cover the full common 2D API surface used by the codebase.
// ---------------------------------------------------------------------------
function makeCtxStub(): CanvasRenderingContext2D {
  return {
    scale: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    setTransform: vi.fn(),
    getTransform: vi.fn(),
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    canvas: null as unknown as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: vi.fn(() => makeCtxStub()),
  });
  overlayLifecycleState.enabled = false;
  depthAtmosphereEnabled.current = false;
  defenderHitState.current = new Map();
  combatIndicatorState.current = [];
  overlayLifecycleState.mountedIds = ['fx.self.healing-pulse'];
  overlayLifecycleState.cleanupIds = [];
  overlayLifecycleState.mountedOwnership = {
    animationIds: ['fx.self.healing-pulse'],
    entityIds: [],
    statusPresentation: false,
    combatIndicators: false,
  };
  overlayLifecycleState.cleanupOwnership = {
    animationIds: [],
    entityIds: [],
    statusPresentation: false,
    combatIndicators: false,
  };
});

// ---------------------------------------------------------------------------
// Shared test fixture helpers
// ---------------------------------------------------------------------------

const BASE_MAP: MapView = {
  width: 20,
  height: 10,
  dangerLevel: 'moderate',
  playerPosition: { x: 5, y: 5 },
  biomeId: 'dungeon',
  cells: Array.from({ length: 200 }, (_, i) => ({
    x: i % 20,
    y: Math.floor(i / 20),
    ascii: '.',
    color: '#aaa',
    bgColor: '#000',
    visibility: 'visible' as const,
    walkable: true,
    tileType: 'floor' as const,
  })),
  entities: [],
};

function makeHandledConsumableAnimation(
  overrides?: Partial<(typeof consumableAnimationState.current)[number]>,
) {
  return {
    id: 'consumable-0',
    effect: 'heal',
    animationId: 'fx.self.healing-pulse',
    playerPos: { x: 5, y: 5 },
    durationMs: 500,
    startTime: 0,
    progress: 0.1,
    ...overrides,
  };
}

function makeHandledFxAnimation(
  overrides?: Partial<(typeof fxAnimationState.current)[number]>,
) {
  return {
    id: 'fx-0',
    abilityId: 'fireball',
    animationId: 'fx.self.healing-pulse',
    playerPos: { x: 5, y: 5 },
    durationMs: 400,
    impactFrameMs: 200,
    startTime: 0,
    progress: 0.2,
    ...overrides,
  };
}

function createMockGameView(overrides?: Partial<GameView>): GameView {
  return {
    gameId: 'test-game',
    phase: 'dungeon',
    player: {
      name: 'Hero',
      level: 1,
      health: 50,
      maxHealth: 100,
      attack: 10,
      defense: 5,
      accuracy: 80,
      evasion: 20,
      speed: 1,
      totalDamageMin: 5,
      totalDamageMax: 15,
      resistances: {},
      gold: 100,
      floor: 1,
      experience: 0,
      experienceForNextLevel: 100,
      biomeId: null,
      biomeColor: '#888888',
      statuses: [],
      abilities: [],
      weaponMastery: null,
      equippedItems: [],
      statBreakdowns: {},
      activeQuests: [],
      factionProgress: [],
      ogreProgress: {
        status: 'sealed',
        selectedSpawnDepth: null,
        eligibleSpawnDepths: [],
        brokenFactions: 0,
        totalFactions: 4,
        summaryText: '0/4 factions broken. Break 4 more to reveal the Dungeon Ogre.',
      },
      ringSchoolMasteries: [],
      learnedSpells: [],
      studyableSpells: [],
    },
    map: BASE_MAP,
    combatLog: [],
    availableActions: [
      { id: 'wait', label: 'Wait', type: 'wait', enabled: true } as AvailableAction,
    ],
    town: null,
    inventory: {
      items: [],
      equipped: {
        weapon: null,
        secondaryWeapon: null,
        chest: null,
        head: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
      },
    },
    activeQuests: [],
    runResult: null,
    deathStashFloor: null,
    deathSummary: null,
    deathContext: null,
    inspectableEntities: [],
    debugMode: false,
    animatedEvents: [],
    ...overrides,
  };
}

function renderDungeonPhase(viewOverrides?: Partial<GameView>, extraProps?: { useSprites?: boolean }) {
  const view = createMockGameView(viewOverrides);
  return render(
    <DungeonPhase
      view={view}
      combatLog={[]}
      loading={false}
      error={null}
      sendCommand={vi.fn()}
      useSprites={extraProps?.useSprites ?? false}
      setUseSprites={vi.fn()}
    />,
  );
}

// ---------------------------------------------------------------------------
// 1. Legacy DungeonPhase rendering (smoke + regression)
// ---------------------------------------------------------------------------

describe('DungeonPhase – legacy rendering (regression)', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    animationRendererMode.current = 'canvas';
    bumpAnimationState.current = [];
    moveAnimationState.current = [];
    consumableAnimationState.current = [];
    fxAnimationState.current = [];
    combatIndicatorState.current = [];
    defenderHitState.current = new Map();
    gameStoreSpy.statuses = [];
    dungeonRenderStateResult.current = null;
    displayMapState.current = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders player HUD with name and HP bar', () => {
    renderDungeonPhase();
    expect(screen.getByText(/Hero/)).toBeInTheDocument();
    expect(screen.getAllByText(/^HP$/i).length).toBeGreaterThan(0);
  });

  it('renders danger indicator from map', () => {
    renderDungeonPhase();
    expect(screen.getByTestId('danger-indicator')).toBeInTheDocument();
    expect(screen.getByText(/Moderate/i)).toBeInTheDocument();
  });

  it('renders Wait action button', () => {
    renderDungeonPhase();
    expect(screen.getByRole('button', { name: /Wait/i })).toBeVisible();
  });

  it('renders without crashing when no actions available', () => {
    renderDungeonPhase({ availableActions: [] });
    expect(screen.getByText(/Hero/)).toBeInTheDocument();
  });

  it('displays an error message when the error prop is set', () => {
    const view = createMockGameView();
    render(
      <DungeonPhase
        view={view}
        combatLog={[]}
        loading={false}
        error="Something went wrong"
        sendCommand={vi.fn()}
        useSprites={false}
        setUseSprites={vi.fn()}
      />,
    );
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it('displays combat log entries in the mini log', () => {
    const view = createMockGameView();
    render(
      <DungeonPhase
        view={view}
        combatLog={[
          { text: '[Hero -> Goblin] 15 physical dmg', type: 'attack' },
          { text: 'Goblin defeated!', type: 'loot' },
        ]}
        loading={false}
        error={null}
        sendCommand={vi.fn()}
        useSprites={false}
        setUseSprites={vi.fn()}
      />,
    );
    expect(screen.getByText(/Hero -> Goblin/)).toBeInTheDocument();
    expect(screen.getByText(/Goblin defeated/)).toBeInTheDocument();
  });

  it('renders on mobile without errors', () => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: true });
    renderDungeonPhase();
    expect(screen.getByRole('button', { name: /Wait/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Flag-off – only DungeonCanvas, no ThreeAnimationOverlay
// ---------------------------------------------------------------------------

describe('DungeonPhase – Three flag OFF (canvas-only behavior unchanged)', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    vi.mocked(getAnimationRendererMode).mockReturnValue('canvas');
    animationRendererMode.current = 'canvas';
    bumpAnimationState.current = [];
    moveAnimationState.current = [];
    consumableAnimationState.current = [];
    fxAnimationState.current = [];
    combatIndicatorState.current = [];
    defenderHitState.current = new Map();
    gameStoreSpy.statuses = [];
    dungeonRenderStateResult.current = null;
    displayMapState.current = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not render ThreeAnimationOverlay', () => {
    renderDungeonPhase({}, { useSprites: true });
    expect(screen.queryByTestId('three-animation-overlay')).not.toBeInTheDocument();
  });

  it('renders a canvas element for DungeonCanvas', () => {
    const { container } = renderDungeonPhase({}, { useSprites: true });
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('still renders the map container and danger indicator', () => {
    renderDungeonPhase({}, { useSprites: true });
    expect(screen.getByTestId('danger-indicator')).toBeInTheDocument();
  });

  it('ThreeAnimationOverlay mock is not called when flag is off', () => {
    renderDungeonPhase({}, { useSprites: true });
    expect(vi.mocked(ThreeAnimationOverlay)).not.toHaveBeenCalled();
  });

  it('useSprites=false (DungeonView path) also has no overlay', () => {
    renderDungeonPhase({}, { useSprites: false });
    expect(screen.queryByTestId('three-animation-overlay')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Flag-on – both DungeonCanvas and ThreeAnimationOverlay rendered
// ---------------------------------------------------------------------------

describe('DungeonPhase – Three flag ON', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    vi.mocked(getAnimationRendererMode).mockReturnValue('three');
    animationRendererMode.current = 'three';
    bumpAnimationState.current = [];
    moveAnimationState.current = [];
    consumableAnimationState.current = [makeHandledConsumableAnimation()];
    fxAnimationState.current = [];
    defenderHitState.current = new Map();
    gameStoreSpy.statuses = [];
    dungeonRenderStateResult.current = null;
    displayMapState.current = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders ThreeAnimationOverlay when flag is enabled', () => {
    renderDungeonPhase({}, { useSprites: true });
    expect(screen.getByTestId('three-animation-overlay')).toBeInTheDocument();
  });

  it('does not render ThreeAnimationOverlay when only unhandled animations are active', () => {
    consumableAnimationState.current = [
      makeHandledConsumableAnimation({ animationId: 'fx.other.unhandled' }),
    ];

    renderDungeonPhase({}, { useSprites: true });

    expect(screen.queryByTestId('three-animation-overlay')).not.toBeInTheDocument();
    expect(vi.mocked(ThreeAnimationOverlay)).not.toHaveBeenCalled();
  });

  it('does not render ThreeAnimationOverlay with no active visuals when atmosphere is disabled', () => {
    consumableAnimationState.current = [];
    fxAnimationState.current = [];

    renderDungeonPhase({}, { useSprites: true });

    expect(screen.queryByTestId('three-animation-overlay')).not.toBeInTheDocument();
    expect(vi.mocked(ThreeAnimationOverlay)).not.toHaveBeenCalled();
  });

  it('renders ThreeAnimationOverlay with no active visuals when atmosphere is enabled', () => {
    consumableAnimationState.current = [];
    fxAnimationState.current = [];
    depthAtmosphereEnabled.current = true;

    renderDungeonPhase({}, { useSprites: true });

    expect(screen.getByTestId('three-animation-overlay')).toHaveAttribute(
      'data-atmosphere-enabled',
      'true',
    );
  });

  it('renders ThreeAnimationOverlay for move ownership even without a handled module animation', () => {
    consumableAnimationState.current = [];
    moveAnimationState.current = [
      {
        id: 'move-0',
        entityId: 'goblin-1',
        fromPos: { x: 4, y: 5 },
        toPos: { x: 5, y: 5 },
        style: 'step',
        progress: 0.4,
        durationMs: 120,
        startTime: 0,
        fromOffsetPx: { x: 0, y: 0 },
      },
    ];

    renderDungeonPhase({
      map: {
        ...BASE_MAP,
        entities: [{
          id: 'goblin-1',
          x: 5,
          y: 5,
          ascii: 'g',
          color: '#55ff55',
          name: 'Goblin',
          type: 'enemy',
          templateId: 'goblin',
        }],
      },
    }, { useSprites: true });

    expect(screen.getByTestId('three-animation-overlay')).toBeInTheDocument();
  });

  it('also renders DungeonCanvas alongside the overlay', () => {
    const { container } = renderDungeonPhase({}, { useSprites: true });
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(screen.getByTestId('three-animation-overlay')).toBeInTheDocument();
  });

  it('overlay and canvas are siblings inside the map container (same parent)', () => {
    const { container } = renderDungeonPhase({}, { useSprites: true });
    const overlay = screen.getByTestId('three-animation-overlay');
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // Both must share the same parent element.
    expect(overlay.parentElement).toBe(canvas!.parentElement);
  });

  it('passes vpLeft and vpTop from hook output to the overlay', () => {
    renderDungeonPhase({}, { useSprites: true });
    const overlay = screen.getByTestId('three-animation-overlay');
    // The mock renders data attributes from whatever it receives.
    expect(overlay).toHaveAttribute('data-vp-left');
    expect(overlay).toHaveAttribute('data-vp-top');
  });

  it('passes cameraOffset from hook output to the overlay', () => {
    renderDungeonPhase({}, { useSprites: true });
    const overlay = screen.getByTestId('three-animation-overlay');
    expect(overlay).toHaveAttribute('data-camera-offset-x', '0');
    expect(overlay).toHaveAttribute('data-camera-offset-y', '0');
  });

  it('passes animation counts from hook output to overlay', () => {
    bumpAnimationState.current = [
      {
        id: 'bump-0',
        attackerId: 'player-1',
        defenderId: 'goblin-1',
        attackerPos: { x: 5, y: 5 },
        defenderPos: { x: 6, y: 5 },
        durationMs: 300,
        impactFrameMs: 150,
        startTime: Date.now(),
        progress: 0.5,
      },
    ];

    renderDungeonPhase({}, { useSprites: true });
    const overlay = screen.getByTestId('three-animation-overlay');
    expect(overlay).toHaveAttribute('data-bump-count', '1');
    expect(overlay).toHaveAttribute('data-move-count', '0');
    expect(overlay).toHaveAttribute('data-consumable-count', '1');
    expect(overlay).toHaveAttribute('data-fx-count', '0');
  });

  it('passes status presentation count to overlay', () => {
    gameStoreSpy.statuses = [
      {
        id: 'strength_up',
        name: 'Strength Up',
        turnsRemaining: 3,
        beneficial: true,
        presentation: { entityScale: 1.25 },
      },
    ];

    renderDungeonPhase({}, { useSprites: true });
    const overlay = screen.getByTestId('three-animation-overlay');
    expect(overlay).toHaveAttribute('data-status-count', '1');
  });

  it('passes runtime combat indicator labels into the overlay and DOM fallback', () => {
    combatIndicatorState.current = [
      {
        id: 'indicator-1',
        x: 5,
        y: 5,
        text: '-12',
        type: 'damage',
        startTime: Date.now(),
      },
    ];

    renderDungeonPhase({}, { useSprites: true });

    expect(screen.getByTestId('three-animation-overlay')).toHaveAttribute(
      'data-combat-indicator-count',
      '1',
    );
    expect(screen.getByText('-12')).toBeInTheDocument();
  });

  it('useDungeonRenderState is called with map, vpTilesWidth, vpTilesHeight', () => {
    renderDungeonPhase({}, { useSprites: true });
    expect(vi.mocked(useDungeonRenderState)).toHaveBeenCalledWith(
      expect.objectContaining({ playerPosition: expect.any(Object) }), // MapView shape
      expect.any(Number), // vpTilesWidth
      expect.any(Number), // vpTilesHeight
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Overlay pointer-events constraint
// ---------------------------------------------------------------------------

describe('ThreeAnimationOverlay – pointer-events: none', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    vi.mocked(getAnimationRendererMode).mockReturnValue('three');
    animationRendererMode.current = 'three';
    bumpAnimationState.current = [];
    moveAnimationState.current = [];
    consumableAnimationState.current = [makeHandledConsumableAnimation()];
    fxAnimationState.current = [];
    defenderHitState.current = new Map();
    gameStoreSpy.statuses = [];
    displayMapState.current = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('DungeonPhase passes pointer-events: none style to ThreeAnimationOverlay', () => {
    renderDungeonPhase({}, { useSprites: true });
    const overlay = screen.getByTestId('three-animation-overlay');
    // DungeonPhase must forward `style={{ pointerEvents: 'none' }}` to the
    // overlay so mouse clicks pass through to the canvas below.
    expect(overlay).toHaveStyle({ pointerEvents: 'none' });
  });

  it('canvas element retains click cursor (click-to-move not blocked)', () => {
    const { container } = renderDungeonPhase({}, { useSprites: true });
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveStyle({ cursor: 'pointer' });
  });

  it('ThreeAnimationOverlay receives the style prop from DungeonPhase', () => {
    renderDungeonPhase({}, { useSprites: true });
    const callArgs = vi.mocked(ThreeAnimationOverlay).mock.calls[0]?.[0];
    expect(callArgs?.style).toMatchObject({ pointerEvents: 'none' });
  });
});

// ---------------------------------------------------------------------------
// 5. Props flow – no animation state duplication
// ---------------------------------------------------------------------------

describe('DungeonPhase – props flow and no duplication', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    vi.mocked(getAnimationRendererMode).mockReturnValue('three');
    animationRendererMode.current = 'three';
    bumpAnimationState.current = [];
    moveAnimationState.current = [];
    consumableAnimationState.current = [];
    fxAnimationState.current = [];
    combatIndicatorState.current = [];
    defenderHitState.current = new Map();
    gameStoreSpy.statuses = [];
    dungeonRenderStateResult.current = null;
    displayMapState.current = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('useDungeonRenderState is called exactly once per render', () => {
    renderDungeonPhase({}, { useSprites: true });
    // A single MapDisplay render → one hook invocation, not one per renderer.
    expect(vi.mocked(useDungeonRenderState)).toHaveBeenCalledTimes(1);
  });

  it('hook receives the map prop passed to DungeonPhase', () => {
    const customMap: MapView = {
      ...BASE_MAP,
      dangerLevel: 'deadly',
      playerPosition: { x: 3, y: 7 },
    };
    renderDungeonPhase({ map: customMap }, { useSprites: true });

    const [mapArg] = vi.mocked(useDungeonRenderState).mock.calls[0]!;
    expect(mapArg).toBe(customMap);
  });

  it('passes the retained display map to DungeonCanvas instead of the raw final map', async () => {
    const rawMap: MapView = {
      ...BASE_MAP,
      entities: [],
    };
    displayMapState.current = {
      ...rawMap,
      entities: [
        {
          id: 'enemy-1',
          x: 6,
          y: 5,
          ascii: 'g',
          color: '#0f0',
          name: 'Retained Goblin',
          type: 'enemy',
          templateId: 'goblin',
        },
      ],
    };

    renderDungeonPhase({ map: rawMap }, { useSprites: true });

    await waitFor(() => {
      expect(vi.mocked(renderMap).mock.calls.at(-1)?.[1]).toEqual(displayMapState.current);
    });
  });

  it('passes the retained display map through the ASCII renderer path', () => {
    const rawMap: MapView = {
      ...BASE_MAP,
      entities: [],
    };
    displayMapState.current = {
      ...rawMap,
      entities: [
        {
          id: 'enemy-1',
          x: 6,
          y: 5,
          ascii: 'g',
          color: '#0f0',
          name: 'Retained Goblin',
          type: 'enemy',
          templateId: 'goblin',
        },
      ],
    };

    renderDungeonPhase({ map: rawMap }, { useSprites: false });

    expect(screen.getByTitle('Retained Goblin')).toBeInTheDocument();
  });

  it('passes the retained display map to the Three overlay path', () => {
    vi.mocked(getAnimationRendererMode).mockReturnValue('three');
    animationRendererMode.current = 'three';
    consumableAnimationState.current = [makeHandledConsumableAnimation()];
    displayMapState.current = {
      ...BASE_MAP,
      entities: [
        {
          id: 'enemy-1',
          x: 6,
          y: 5,
          ascii: 'g',
          color: '#0f0',
          name: 'Retained Goblin',
          type: 'enemy',
          templateId: 'goblin',
        },
      ],
    };

    renderDungeonPhase({}, { useSprites: true });

    expect(vi.mocked(ThreeAnimationOverlay).mock.calls.at(-1)?.[0].map).toEqual(displayMapState.current);
  });

  it('animation arrays flowing into the overlay come from hook output, not independent subscriptions', () => {
    // Populate all four animation buckets through the shared state bags.
    bumpAnimationState.current = [
      { id: 'bump-0', attackerId: 'p', defenderId: 'e', attackerPos: { x: 0, y: 0 }, defenderPos: { x: 1, y: 0 }, durationMs: 300, impactFrameMs: 150, startTime: 0, progress: 0.5 },
    ];
    moveAnimationState.current = [
      { id: 'move-0', entityId: 'p', fromPos: { x: 0, y: 0 }, toPos: { x: 1, y: 0 }, style: 'step', progress: 0.3, durationMs: 120, startTime: 0, fromOffsetPx: { x: 0, y: 0 } },
    ];
    consumableAnimationState.current = [
      makeHandledConsumableAnimation(),
    ];
    fxAnimationState.current = [
      makeHandledFxAnimation(),
    ];

    renderDungeonPhase({}, { useSprites: true });

    const overlay = screen.getByTestId('three-animation-overlay');
    // All four counts are 1 — they came from the same hook call, not four
    // separate subscriptions that could diverge.
    expect(overlay).toHaveAttribute('data-bump-count', '1');
    expect(overlay).toHaveAttribute('data-move-count', '1');
    expect(overlay).toHaveAttribute('data-consumable-count', '1');
    expect(overlay).toHaveAttribute('data-fx-count', '1');

    // Exactly one hook call confirms no duplication.
    expect(vi.mocked(useDungeonRenderState)).toHaveBeenCalledTimes(1);
  });

  it('hook output is captured in dungeonRenderStateResult for assertion', () => {
    renderDungeonPhase({}, { useSprites: true });
    // After render the hoisted spy records what the hook returned.
    expect(dungeonRenderStateResult.current).not.toBeNull();
    expect(dungeonRenderStateResult.current).toMatchObject({
      displayMap: expect.any(Object),
      bumpAnimations: expect.any(Array),
      moveAnimations: expect.any(Array),
      consumableAnimations: expect.any(Array),
      fxAnimations: expect.any(Array),
      statusPresentations: expect.any(Array),
      vpLeft: expect.any(Number),
      vpTop: expect.any(Number),
      cameraOffset: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    });
  });

  it('vpTilesWidth and vpTilesHeight passed to hook are positive integers', () => {
    renderDungeonPhase({}, { useSprites: true });
    const [, vpW, vpH] = vi.mocked(useDungeonRenderState).mock.calls[0]!;
    expect(Number.isInteger(vpW)).toBe(true);
    expect(Number.isInteger(vpH)).toBe(true);
    expect(vpW).toBeGreaterThan(0);
    expect(vpH).toBeGreaterThan(0);
  });
});

describe('DungeonPhase – overlay ownership and canvas fallback', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({ isMobile: false });
    vi.mocked(getAnimationRendererMode).mockReturnValue('three');
    animationRendererMode.current = 'three';
    bumpAnimationState.current = [];
    moveAnimationState.current = [];
    consumableAnimationState.current = [makeHandledConsumableAnimation()];
    fxAnimationState.current = [];
    defenderHitState.current = new Map();
    gameStoreSpy.statuses = [];
    dungeonRenderStateResult.current = null;
    overlayLifecycleState.enabled = true;
    displayMapState.current = null;
    overlayLifecycleState.mountedIds = ['fx.self.healing-pulse'];
    overlayLifecycleState.cleanupIds = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards overlay-owned animation IDs to DungeonCanvas skipHandledAnimationIds', async () => {
    renderDungeonPhase({}, { useSprites: true });

    await waitFor(() => {
      expect(vi.mocked(renderMap).mock.calls.at(-1)?.[12]).toEqual(['fx.self.healing-pulse']);
    });
  });

  it('clears DungeonCanvas skipHandledAnimationIds when the overlay path tears down', async () => {
    const view = createMockGameView();
    const { rerender } = render(
      <DungeonPhase
        view={view}
        combatLog={[]}
        loading={false}
        error={null}
        sendCommand={vi.fn()}
        useSprites={true}
        setUseSprites={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(vi.mocked(renderMap).mock.calls.at(-1)?.[12]).toEqual(['fx.self.healing-pulse']);
    });

    vi.mocked(getAnimationRendererMode).mockReturnValue('canvas');
    animationRendererMode.current = 'canvas';

    rerender(
      <DungeonPhase
        view={view}
        combatLog={[]}
        loading={false}
        error={null}
        sendCommand={vi.fn()}
        useSprites={true}
        setUseSprites={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(vi.mocked(renderMap).mock.calls.at(-1)?.[12]).toEqual([]);
    });
  });

  it('suppresses status ring and entityScale on the canvas after Three owns the player status presentation', async () => {
    overlayLifecycleState.mountedIds = ['fx.status.gold-ring-pulse'];
    overlayLifecycleState.mountedOwnership = {
      animationIds: ['fx.status.gold-ring-pulse'],
      entityIds: ['player-1'],
      statusPresentation: true,
      combatIndicators: false,
    };
    gameStoreSpy.statuses = [
      {
        id: 'strength_up',
        name: 'Strength Up',
        turnsRemaining: 3,
        beneficial: true,
        presentation: {
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
      },
    ];

    renderDungeonPhase({
      map: {
        ...BASE_MAP,
        entities: [
          {
            id: 'player-1',
            x: 5,
            y: 5,
            ascii: '@',
            color: '#ffffff',
            name: 'Hero',
            type: 'player',
            templateId: null,
          },
        ],
      },
    }, { useSprites: true });

    await waitFor(() => {
      expect(vi.mocked(renderMap).mock.calls.at(-1)?.[1]?.entities).toEqual([]);
      expect(vi.mocked(renderMap).mock.calls.at(-1)?.[10]).toEqual({
        statusPresentations: [],
      });
    });
  });

  it('filters canvas to exclude Three-owned status presentations when ownership is mixed', async () => {
    overlayLifecycleState.mountedIds = ['fx.status.gold-ring-pulse'];
    overlayLifecycleState.mountedOwnership = {
      animationIds: ['fx.status.gold-ring-pulse'],
      entityIds: ['player-1'],
      statusPresentation: false, // false: not all statuses are owned by Three
      combatIndicators: false,
    };
    gameStoreSpy.statuses = [
      {
        id: 'strength_up',
        name: 'Strength Up',
        turnsRemaining: 3,
        beneficial: true,
        presentation: {
          animationId: 'fx.status.gold-ring-pulse', // Three-owned
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
      },
      {
        id: 'fire_weakness',
        name: 'Fire Weakness',
        turnsRemaining: 2,
        beneficial: false,
        presentation: {
          // No animationId: canvas-only status
          entityScale: 1.1,
          ring: {
            colorRgb: '255, 50, 0',
            alphaBase: 0.3,
            alphaAmplitude: 0.4,
            pulsePeriodMs: 200,
            lineWidth: 1,
            paddingPx: 1,
          },
        },
      },
    ];

    renderDungeonPhase({
      map: {
        ...BASE_MAP,
        entities: [
          {
            id: 'player-1',
            x: 5,
            y: 5,
            ascii: '@',
            color: '#ffffff',
            name: 'Hero',
            type: 'player',
            templateId: null,
          },
        ],
      },
    }, { useSprites: true });

    await waitFor(() => {
      // Canvas should receive only the unowned status (fire_weakness)
      const canvasStatusArg = vi.mocked(renderMap).mock.calls.at(-1)?.[10];
      expect(canvasStatusArg?.statusPresentations).toHaveLength(1);
      expect(canvasStatusArg?.statusPresentations?.[0]?.ring?.colorRgb).toBe('255, 50, 0');

      // Overlay should have the owned animation ID
      expect(screen.getByTestId('three-animation-overlay')).toBeInTheDocument();
    });
  });

  it('suppresses DOM combat indicators after Three claims combat-indicator ownership', async () => {
    combatIndicatorState.current = [
      {
        id: 'indicator-1',
        x: 5,
        y: 5,
        text: '-12',
        type: 'damage',
        startTime: Date.now(),
      },
    ];
    overlayLifecycleState.mountedOwnership = {
      animationIds: ['fx.self.healing-pulse'],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: true,
    };

    renderDungeonPhase({}, { useSprites: true });

    await waitFor(() => {
      expect(screen.getByTestId('three-animation-overlay')).toHaveAttribute(
        'data-combat-indicator-count',
        '1',
      );
      expect(screen.queryByText('-12')).not.toBeInTheDocument();
    });
  });
});
