import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { MapView } from '@dungeon/presenter';
import { CELL_SIZE } from '../config/ui-config.js';

// ── Hoisted spies ─────────────────────────────────────────────────────────────

const { startAutoWalkSpy } = vi.hoisted(() => ({
  startAutoWalkSpy: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

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

vi.mock('../store/game-store.js', () => ({
  useGameStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        startAutoWalk: startAutoWalkSpy,
        view: { animatedEvents: [], player: { statuses: [] } },
      };
      if (typeof selector === 'function') return selector(state);
      return state;
    }),
    {
      getState: () => ({ startAutoWalk: startAutoWalkSpy }),
    },
  ),
}));

// ── Imports that depend on the mocks above ────────────────────────────────────

import { renderMap } from '../sprites/canvas-renderer.js';
import { findPath } from '../utils/pathfinding.js';
import { DungeonCanvas } from './DungeonCanvas.js';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const baseMap: MapView = {
  width: 10,
  height: 10,
  biomeId: 'dungeon',
  dangerLevel: 'moderate',
  playerPosition: { x: 2, y: 2 },
  cells: [
    {
      x: 0, y: 0,
      ascii: '.', color: '#aaa', bgColor: '#000',
      visibility: 'visible', walkable: true, tileType: 'floor',
    },
    {
      x: 2, y: 2,
      ascii: '.', color: '#aaa', bgColor: '#000',
      visibility: 'visible', walkable: true, tileType: 'floor',
    },
    {
      x: 3, y: 2,
      ascii: '.', color: '#aaa', bgColor: '#000',
      visibility: 'visible', walkable: true, tileType: 'floor',
    },
  ],
  entities: [
    {
      id: 'player-1',
      type: 'player' as const,
      x: 2, y: 2,
      color: '#fff', ascii: '@',
      name: 'Player',
      templateId: 'player',
    },
  ],
};

const defaultProps = {
  map: baseMap,
  vpTilesWidth: 5 as const,
  vpTilesHeight: 4 as const,
  bumpAnimations: [] as [],
  moveAnimations: [] as [],
  consumableAnimations: [] as [],
  fxAnimations: [] as [],
  statusPresentations: [] as [],
  vpLeft: 0,
  vpTop: 0,
  cameraOffset: { x: 0, y: 0 },
};

function setupCanvas() {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      scale: vi.fn(),
      imageSmoothingEnabled: false,
    }) as unknown as CanvasRenderingContext2D),
  });
}

function fakeBoundingRect(canvas: HTMLCanvasElement, vpW: number, vpH: number) {
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0, top: 0,
      width: vpW * CELL_SIZE, height: vpH * CELL_SIZE,
      right: vpW * CELL_SIZE, bottom: vpH * CELL_SIZE,
      x: 0, y: 0,
      toJSON: () => '',
    }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DungeonCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startAutoWalkSpy.mockReset();
    vi.mocked(findPath).mockReturnValue([]);
    setupCanvas();
  });

  // ── 1. Prop-driven rendering ──────────────────────────────────────────────

  describe('prop-driven rendering', () => {
    it('accepts bumpAnimations as a prop and forwards it to renderMap', () => {
      const bumpAnimations = [
        {
          id: 'bump-0',
          attackerId: 'player-1',
          defenderId: 'enemy-1',
          attackerPos: { x: 2, y: 2 },
          defenderPos: { x: 3, y: 2 },
          durationMs: 300,
          impactFrameMs: 150,
          progress: 0.5,
        },
      ];

      render(<DungeonCanvas {...defaultProps} bumpAnimations={bumpAnimations as any[]} />);

      expect(vi.mocked(renderMap)).toHaveBeenCalled();
      // bumpAnimations is arg index 6
      expect(vi.mocked(renderMap).mock.calls[0]?.[6]).toEqual(bumpAnimations);
    });

    it('accepts moveAnimations as a prop and forwards it to renderMap', () => {
      const moveAnimations = [
        {
          id: 'move-0',
          entityId: 'player-1',
          fromPos: { x: 1, y: 2 },
          toPos: { x: 2, y: 2 },
          style: 'step' as const,
          progress: 0.4,
          durationMs: 120,
        },
      ];

      render(<DungeonCanvas {...defaultProps} moveAnimations={moveAnimations as any[]} />);

      expect(vi.mocked(renderMap)).toHaveBeenCalled();
      // moveAnimations is arg index 7
      expect(vi.mocked(renderMap).mock.calls[0]?.[7]).toEqual(moveAnimations);
    });

    it('accepts consumableAnimations as a prop and forwards it to renderMap', () => {
      const consumableAnimations = [
        {
          id: 'consumable-0',
          effect: 'heal' as const,
          playerPos: { x: 2, y: 2 },
          blastPositions: [],
          startTime: 0,
          progress: 0.2,
          durationMs: 500,
          presentation: { color: '#0f0', label: '+HP' },
        },
      ];

      render(<DungeonCanvas {...defaultProps} consumableAnimations={consumableAnimations as any[]} />);

      expect(vi.mocked(renderMap)).toHaveBeenCalled();
      // consumableAnimations is arg index 8
      expect(vi.mocked(renderMap).mock.calls[0]?.[8]).toEqual(consumableAnimations);
    });

    it('accepts fxAnimations as a prop and forwards it to renderMap', () => {
      const fxAnimations = [
        {
          id: 'fx-0',
          abilityId: 'fireball',
          animationId: 'anim_fireball',
          playerPos: { x: 2, y: 2 },
          targetPos: { x: 4, y: 2 },
          blastPositions: [{ x: 4, y: 2 }],
          durationMs: 400,
          suppressActorBump: false,
          progress: 0.3,
        },
      ];

      render(<DungeonCanvas {...defaultProps} fxAnimations={fxAnimations as any[]} />);

      expect(vi.mocked(renderMap)).toHaveBeenCalled();
      // fxAnimations is arg index 9
      expect(vi.mocked(renderMap).mock.calls[0]?.[9]).toEqual(fxAnimations);
    });

    it('accepts statusPresentations as a prop and forwards it to renderMap as PlayerEffects', () => {
      const statusPresentations = [
        { entityScale: 1.5, ring: undefined },
        { entityScale: 1.0 },
      ];

      render(<DungeonCanvas {...defaultProps} statusPresentations={statusPresentations} />);

      expect(vi.mocked(renderMap)).toHaveBeenCalled();
      // playerEffects is arg index 10
      expect(vi.mocked(renderMap).mock.calls[0]?.[10]).toEqual({ statusPresentations });
    });

    it('accepts vpLeft and vpTop as props and passes them to renderMap', () => {
      render(<DungeonCanvas {...defaultProps} vpLeft={3} vpTop={1} />);

      expect(vi.mocked(renderMap)).toHaveBeenCalled();
      // vpLeft is arg index 2, vpTop is arg index 3
      expect(vi.mocked(renderMap).mock.calls[0]?.[2]).toBe(3);
      expect(vi.mocked(renderMap).mock.calls[0]?.[3]).toBe(1);
    });

    it('accepts cameraOffset as a prop and passes it to renderMap', () => {
      const cameraOffset = { x: -12, y: 0 };

      render(<DungeonCanvas {...defaultProps} cameraOffset={cameraOffset} />);

      expect(vi.mocked(renderMap)).toHaveBeenCalled();
      // cameraOffset is arg index 11
      expect(vi.mocked(renderMap).mock.calls[0]?.[11]).toEqual(cameraOffset);
    });

    it('accepts skipHandledAnimationIds as a prop and passes it to renderMap', () => {
      const skipHandledAnimationIds = ['fx.self.healing-pulse'] as const;

      render(
        <DungeonCanvas
          {...defaultProps}
          skipHandledAnimationIds={skipHandledAnimationIds}
        />,
      );

      expect(vi.mocked(renderMap)).toHaveBeenCalled();
      // skipHandledAnimationIds is arg index 12
      expect(vi.mocked(renderMap).mock.calls[0]?.[12]).toEqual(skipHandledAnimationIds);
    });

    it('does not import or call animation hooks — rendering is driven purely by props', () => {
      // If the component still calls the animation hooks it would pull values
      // from the hook mocks, not the props.  Verify the exact prop values
      // reach renderMap with no transformation.
      const bumpAnimations = [
        {
          id: 'bump-prop',
          attackerId: 'a', defenderId: 'b',
          attackerPos: { x: 0, y: 0 }, defenderPos: { x: 1, y: 0 },
          durationMs: 200, impactFrameMs: 100, progress: 0.9,
        },
      ];
      const moveAnimations = [
        {
          id: 'move-prop',
          entityId: 'player-1',
          fromPos: { x: 1, y: 2 }, toPos: { x: 2, y: 2 },
          style: 'dart' as const, progress: 0.7, durationMs: 80,
        },
      ];
      const consumableAnimations = [
        {
          id: 'cons-prop',
          effect: 'buff' as const,
          playerPos: { x: 2, y: 2 }, blastPositions: [],
          startTime: 0, progress: 0.1, durationMs: 600,
          presentation: { color: '#00f', label: 'Buff' },
        },
      ];
      const fxAnimations = [
        {
          id: 'fx-prop',
          abilityId: 'lightning', animationId: 'anim_lightning',
          playerPos: { x: 2, y: 2 }, blastPositions: [],
          durationMs: 300, suppressActorBump: true, progress: 0.5,
        },
      ];

      render(
        <DungeonCanvas
          {...defaultProps}
          bumpAnimations={bumpAnimations as any[]}
          moveAnimations={moveAnimations as any[]}
          consumableAnimations={consumableAnimations as any[]}
          fxAnimations={fxAnimations as any[]}
        />,
      );

      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[6]).toEqual(bumpAnimations);
      expect(call?.[7]).toEqual(moveAnimations);
      expect(call?.[8]).toEqual(consumableAnimations);
      expect(call?.[9]).toEqual(fxAnimations);
    });

    it('renders with empty arrays for all animation props (no crash)', () => {
      expect(() => render(<DungeonCanvas {...defaultProps} />)).not.toThrow();
      expect(vi.mocked(renderMap)).toHaveBeenCalled();
    });
  });

  // ── 2. Canvas context setup ───────────────────────────────────────────────

  describe('canvas context setup', () => {
    it('sizes the canvas from vpTilesWidth and vpTilesHeight using the shared CELL_SIZE', () => {
      const { container } = render(
        <DungeonCanvas {...defaultProps} vpTilesWidth={5} vpTilesHeight={4} />,
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.style.width).toBe(`${5 * CELL_SIZE}px`);
      expect(canvas?.style.height).toBe(`${4 * CELL_SIZE}px`);
      expect(canvas?.width).toBe(5 * CELL_SIZE);
      expect(canvas?.height).toBe(4 * CELL_SIZE);
    });

    it('calls renderMap once on initial mount', () => {
      render(<DungeonCanvas {...defaultProps} />);
      expect(vi.mocked(renderMap)).toHaveBeenCalledTimes(1);
    });

    it('calls renderMap with the map as first data argument (index 1)', () => {
      render(<DungeonCanvas {...defaultProps} map={baseMap} />);
      expect(vi.mocked(renderMap).mock.calls[0]?.[1]).toBe(baseMap);
    });

    it('passes vpTilesWidth and vpTilesHeight to renderMap (indices 4 and 5)', () => {
      render(<DungeonCanvas {...defaultProps} vpTilesWidth={7} vpTilesHeight={6} />);
      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[4]).toBe(7);
      expect(call?.[5]).toBe(6);
    });

    it('calls renderMap again when a prop changes', () => {
      const { rerender } = render(<DungeonCanvas {...defaultProps} />);
      expect(vi.mocked(renderMap)).toHaveBeenCalledTimes(1);

      rerender(<DungeonCanvas {...defaultProps} vpLeft={1} />);
      expect(vi.mocked(renderMap)).toHaveBeenCalledTimes(2);
    });
  });

  // ── 3. Click-to-move ─────────────────────────────────────────────────────

  describe('click-to-move input', () => {
    it('starts auto-walk when clicking a reachable walkable tile', () => {
      const path = [{ x: 2, y: 2 }, { x: 3, y: 2 }];
      vi.mocked(findPath).mockReturnValue(path);

      const { container } = render(
        <DungeonCanvas {...defaultProps} vpLeft={0} vpTop={0} />,
      );

      const canvas = container.querySelector('canvas')!;
      fakeBoundingRect(canvas, 5, 4);

      // Click on tile (3, 2) — offset x=3*CELL_SIZE+1, y=2*CELL_SIZE+1
      fireEvent.click(canvas, {
        clientX: 3 * CELL_SIZE + 1,
        clientY: 2 * CELL_SIZE + 1,
      });

      expect(findPath).toHaveBeenCalledWith(
        baseMap,
        baseMap.playerPosition,
        { x: 3, y: 2 },
      );
      expect(startAutoWalkSpy).toHaveBeenCalledWith(path);
    });

    it('does not dispatch a walk when the clicked tile is not walkable', () => {
      const nonWalkableMap: MapView = {
        ...baseMap,
        cells: [
          {
            x: 3, y: 2,
            ascii: '#', color: '#888', bgColor: '#000',
            visibility: 'visible', walkable: false, tileType: 'wall' as const,
          },
        ],
      };

      const { container } = render(
        <DungeonCanvas {...defaultProps} map={nonWalkableMap} vpLeft={0} vpTop={0} />,
      );

      const canvas = container.querySelector('canvas')!;
      fakeBoundingRect(canvas, 5, 4);

      fireEvent.click(canvas, {
        clientX: 3 * CELL_SIZE + 1,
        clientY: 2 * CELL_SIZE + 1,
      });

      expect(findPath).not.toHaveBeenCalled();
      expect(startAutoWalkSpy).not.toHaveBeenCalled();
    });

    it('does not path or dispatch a walk when the clicked tile is hidden', () => {
      const hiddenCellMap: MapView = {
        ...baseMap,
        cells: [
          {
            x: 3, y: 2,
            ascii: '.', color: '#888', bgColor: '#000',
            visibility: 'hidden', walkable: true, tileType: 'floor' as const,
          },
        ],
      };

      const { container } = render(
        <DungeonCanvas {...defaultProps} map={hiddenCellMap} vpLeft={0} vpTop={0} />,
      );

      const canvas = container.querySelector('canvas')!;
      fakeBoundingRect(canvas, 5, 4);

      fireEvent.click(canvas, {
        clientX: 3 * CELL_SIZE + 1,
        clientY: 2 * CELL_SIZE + 1,
      });

      expect(findPath).not.toHaveBeenCalled();
      expect(startAutoWalkSpy).not.toHaveBeenCalled();
    });

    it('does not path or dispatch a walk when the clicked tile is missing from the map data', () => {
      const { container } = render(
        <DungeonCanvas {...defaultProps} vpLeft={0} vpTop={0} />,
      );

      const canvas = container.querySelector('canvas')!;
      fakeBoundingRect(canvas, 5, 4);

      fireEvent.click(canvas, {
        clientX: 4 * CELL_SIZE + 1,
        clientY: 3 * CELL_SIZE + 1,
      });

      expect(findPath).not.toHaveBeenCalled();
      expect(startAutoWalkSpy).not.toHaveBeenCalled();
    });

    it('does not dispatch a walk when findPath returns an empty path', () => {
      vi.mocked(findPath).mockReturnValue([]);

      const { container } = render(
        <DungeonCanvas {...defaultProps} vpLeft={0} vpTop={0} />,
      );

      const canvas = container.querySelector('canvas')!;
      fakeBoundingRect(canvas, 5, 4);

      fireEvent.click(canvas, {
        clientX: 3 * CELL_SIZE + 1,
        clientY: 2 * CELL_SIZE + 1,
      });

      expect(startAutoWalkSpy).not.toHaveBeenCalled();
    });

    it('ignores clicks outside the viewport tile bounds', () => {
      const { container } = render(
        <DungeonCanvas {...defaultProps} vpTilesWidth={3} vpTilesHeight={3} vpLeft={0} vpTop={0} />,
      );

      const canvas = container.querySelector('canvas')!;
      fakeBoundingRect(canvas, 3, 3);

      // Click at tileX = -1 (negative, out of bounds)
      fireEvent.click(canvas, { clientX: -5, clientY: 0 });
      expect(startAutoWalkSpy).not.toHaveBeenCalled();
    });

    it('converts click coordinates to tile coords using the vpLeft/vpTop props', () => {
      // vpLeft=2 means the left edge of the canvas is tile column 2
      const path = [{ x: 5, y: 4 }];
      vi.mocked(findPath).mockReturnValue(path);

      const shiftedMap: MapView = {
        ...baseMap,
        cells: [
          ...baseMap.cells,
          {
            x: 5, y: 4,
            ascii: '.', color: '#aaa', bgColor: '#000',
            visibility: 'visible', walkable: true, tileType: 'floor' as const,
          },
        ],
      };

      const { container } = render(
        <DungeonCanvas
          {...defaultProps}
          map={shiftedMap}
          vpLeft={2}
          vpTop={2}
          vpTilesWidth={5}
          vpTilesHeight={4}
        />,
      );

      const canvas = container.querySelector('canvas')!;
      fakeBoundingRect(canvas, 5, 4);

      // Tile (5,4) in grid = screen tile (3,2) = pixel (3*CELL_SIZE+1, 2*CELL_SIZE+1)
      fireEvent.click(canvas, {
        clientX: 3 * CELL_SIZE + 1,
        clientY: 2 * CELL_SIZE + 1,
      });

      expect(findPath).toHaveBeenCalledWith(shiftedMap, shiftedMap.playerPosition, { x: 5, y: 4 });
      expect(startAutoWalkSpy).toHaveBeenCalledWith(path);
    });
  });

  // ── 4. Animation integration ──────────────────────────────────────────────

  describe('animation integration', () => {
    it('renders consumable animations when the prop is non-empty', () => {
      const consumableAnimations = [
        {
          id: 'consumable-1',
          effect: 'heal' as const,
          playerPos: { x: 2, y: 2 },
          blastPositions: [{ x: 2, y: 2 }, { x: 3, y: 2 }],
          startTime: 0,
          progress: 0.5,
          durationMs: 500,
          presentation: { color: '#0f0', label: '+20 HP' },
        },
      ];

      render(<DungeonCanvas {...defaultProps} consumableAnimations={consumableAnimations as any[]} />);

      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[8]).toHaveLength(1);
      expect(call?.[8]?.[0]).toMatchObject({ id: 'consumable-1', effect: 'heal' });
    });

    it('renders fx animations when the prop is non-empty', () => {
      const fxAnimations = [
        {
          id: 'fx-1',
          abilityId: 'ice_bolt',
          animationId: 'anim_ice_bolt',
          playerPos: { x: 2, y: 2 },
          targetPos: { x: 4, y: 2 },
          blastPositions: [{ x: 4, y: 2 }],
          durationMs: 350,
          suppressActorBump: false,
          progress: 0.6,
        },
      ];

      render(<DungeonCanvas {...defaultProps} fxAnimations={fxAnimations as any[]} />);

      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[9]).toHaveLength(1);
      expect(call?.[9]?.[0]).toMatchObject({ id: 'fx-1', abilityId: 'ice_bolt' });
    });

    it('applies bump animations from props to renderMap', () => {
      const bumpAnimations = [
        {
          id: 'bump-1',
          attackerId: 'player-1',
          defenderId: 'goblin-1',
          attackerPos: { x: 2, y: 2 },
          defenderPos: { x: 3, y: 2 },
          durationMs: 300,
          impactFrameMs: 150,
          progress: 0.3,
        },
        {
          id: 'bump-2',
          attackerId: 'goblin-1',
          defenderId: 'player-1',
          attackerPos: { x: 3, y: 2 },
          defenderPos: { x: 2, y: 2 },
          durationMs: 300,
          impactFrameMs: 150,
          progress: 0.7,
        },
      ];

      render(<DungeonCanvas {...defaultProps} bumpAnimations={bumpAnimations as any[]} />);

      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[6]).toHaveLength(2);
    });

    it('applies move animations from props to renderMap', () => {
      const moveAnimations = [
        {
          id: 'move-1',
          entityId: 'goblin-1',
          fromPos: { x: 5, y: 2 },
          toPos: { x: 4, y: 2 },
          style: 'lurch' as const,
          progress: 0.8,
          durationMs: 200,
        },
      ];

      render(<DungeonCanvas {...defaultProps} moveAnimations={moveAnimations as any[]} />);

      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[7]).toHaveLength(1);
      expect(call?.[7]?.[0]).toMatchObject({ entityId: 'goblin-1', style: 'lurch' });
    });

    it('passes an empty statusPresentations array when prop is empty', () => {
      render(<DungeonCanvas {...defaultProps} statusPresentations={[]} />);

      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[10]).toEqual({ statusPresentations: [] });
    });

    it('forwards multiple statusPresentations entries to renderMap', () => {
      const statusPresentations = [
        { entityScale: 1.25 },
        { entityScale: 1.0, ring: { colorRgb: '255,0,0', alphaBase: 0.4, alphaAmplitude: 0.2, pulsePeriodMs: 800, lineWidth: 2, paddingPx: 1 } },
      ];

      render(<DungeonCanvas {...defaultProps} statusPresentations={statusPresentations} />);

      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[10]).toEqual({ statusPresentations });
    });
  });

  // ── 5. Viewport and camera ────────────────────────────────────────────────

  describe('viewport and camera', () => {
    it('passes vpLeft and vpTop from props directly to renderMap without recomputing', () => {
      render(<DungeonCanvas {...defaultProps} vpLeft={5} vpTop={3} />);

      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[2]).toBe(5); // vpLeft
      expect(call?.[3]).toBe(3); // vpTop
    });

    it('passes a zero cameraOffset when prop is { x:0, y:0 }', () => {
      render(<DungeonCanvas {...defaultProps} cameraOffset={{ x: 0, y: 0 }} />);

      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[11]).toEqual({ x: 0, y: 0 });
    });

    it('passes a non-zero cameraOffset from props to renderMap', () => {
      render(<DungeonCanvas {...defaultProps} cameraOffset={{ x: -24, y: 12 }} />);

      const call = vi.mocked(renderMap).mock.calls[0];
      expect(call?.[11]).toEqual({ x: -24, y: 12 });
    });

    it('applies camera offset when converting click coordinates to tile coords', () => {
      // cameraOffset { x: -24, y: 0 } means the canvas appears shifted 24px left
      // so a raw pixel at (1*CELL_SIZE+1) corresponds to tile column 2, not 1
      const path = [{ x: 2, y: 2 }];
      vi.mocked(findPath).mockReturnValue(path);
      const cameraShiftedMap: MapView = {
        ...baseMap,
        cells: [
          ...baseMap.cells,
          {
            x: 2, y: 1,
            ascii: '.', color: '#aaa', bgColor: '#000',
            visibility: 'visible', walkable: true, tileType: 'floor' as const,
          },
        ],
      };

      const { container } = render(
        <DungeonCanvas
          {...defaultProps}
          map={cameraShiftedMap}
          vpLeft={0}
          vpTop={0}
          vpTilesWidth={5}
          vpTilesHeight={4}
          cameraOffset={{ x: -CELL_SIZE, y: 0 }}
        />,
      );

      const canvas = container.querySelector('canvas')!;
      fakeBoundingRect(canvas, 5, 4);

      // Without camera offset, pixel (CELL_SIZE+1, CELL_SIZE+1) → tile (1, 1).
      // With cameraOffset.x = -CELL_SIZE, the effective pixel is shifted:
      // tileX = floor((clientX - rect.left - cameraOffset.x) / renderedTileW)
      //       = floor((CELL_SIZE+1 - (-CELL_SIZE)) / CELL_SIZE)
      //       = floor((2*CELL_SIZE+1) / CELL_SIZE) = 2
      fireEvent.click(canvas, {
        clientX: CELL_SIZE + 1,
        clientY: CELL_SIZE + 1,
      });

      expect(findPath).toHaveBeenCalledWith(
        cameraShiftedMap,
        cameraShiftedMap.playerPosition,
        { x: 2, y: 1 },
      );
    });

    it('reflects vpLeft+vpTop changes on re-render without re-computing them internally', () => {
      const { rerender } = render(
        <DungeonCanvas {...defaultProps} vpLeft={0} vpTop={0} />,
      );
      expect(vi.mocked(renderMap).mock.calls[0]?.[2]).toBe(0);

      rerender(<DungeonCanvas {...defaultProps} vpLeft={4} vpTop={2} />);
      expect(vi.mocked(renderMap).mock.calls[1]?.[2]).toBe(4);
      expect(vi.mocked(renderMap).mock.calls[1]?.[3]).toBe(2);
    });
  });
});
