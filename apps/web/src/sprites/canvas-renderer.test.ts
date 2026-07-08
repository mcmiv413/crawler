/**
 * Test layer: unit
 * Behavior: Canvas Renderer covers canvas-renderer with bump animations; accepts bump animations parameter in renderMap; draws player status presentation without renderer-s....
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/sprites/canvas-renderer.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import type { MapView, EntityView } from '@dungeon/presenter';
import { renderMap } from './canvas-renderer.js';
import { CELL_SIZE } from '../config/ui-config.js';
import * as moveStyleProfiles from '../animations/move-style-profiles.js';

describe('canvas-renderer with bump animations', () => {
  function createMockCanvasContext(): CanvasRenderingContext2D {
    return {
      clearRect: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      globalAlpha: 1,
      strokeStyle: '',
      lineWidth: 0,
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      font: '',
      textAlign: 'center' as const,
      textBaseline: 'middle' as const,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }

  function createMockMapView(): MapView {
    const player = {
      id: 'player-1',
      type: 'player' as const,
      x: 10,
      y: 10,
      color: '#fff',
      ascii: '@',
      name: 'Player',
      templateId: 'player',
    };

    const enemy = {
      id: 'enemy-1',
      type: 'enemy' as const,
      x: 11,
      y: 10,
      color: '#f00',
      ascii: 'e',
      name: 'Enemy',
      templateId: 'goblin',
    };

    return {
      width: 50,
      height: 50,
      playerPosition: { x: 10, y: 10 },
      biomeId: 'dungeon',
      dangerLevel: 'safe' as const,
      cells: [
        {
          x: 10,
          y: 10,
          visibility: 'visible' as const,
          spriteName: 'floor',
          color: '#888',
          ascii: '.',
          bgColor: '#000',
          walkable: true,
          tileType: 'floor',
        },
        {
          x: 11,
          y: 10,
          visibility: 'visible' as const,
          spriteName: 'floor',
          color: '#888',
          ascii: '.',
          bgColor: '#000',
          walkable: true,
          tileType: 'floor',
        },
      ],
      entities: [player, enemy] as EntityView[],
    };
  }

  it('accepts bump animations parameter in renderMap', () => {
    const map = createMockMapView();
    const mockCtx = createMockCanvasContext();

    const bumpAnimations = [
      {
        id: 'bump-1',
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
        durationMs: 140,
        impactFrameMs: 70,
        progress: 0.5,
      },
    ];

    // This test will pass once renderMap is updated to accept bumpAnimations param
    expect(() => {
      renderMap(mockCtx, map, 0, 0, 30, 22, bumpAnimations);
    }).not.toThrow();
  });

  it('draws player status presentation without renderer-side status IDs', () => {
    const map = createMockMapView();
    const mockCtx = createMockCanvasContext();

    renderMap(mockCtx, map, 0, 0, 30, 22, [], [], [], [], {
      statusPresentations: [
        {
          entityScale: 1.5,
          ring: {
            colorRgb: '1, 2, 3',
            alphaBase: 0.2,
            alphaAmplitude: 0,
            pulsePeriodMs: 100,
            lineWidth: 3,
            paddingPx: 4,
          },
        },
      ],
    });

    expect(mockCtx.strokeRect).toHaveBeenCalledWith(
      10 * CELL_SIZE - 4,
      10 * CELL_SIZE - 4,
      CELL_SIZE + 8,
      CELL_SIZE + 8,
    );
  });

  it('overscans the leading edge while the camera pans a player move', () => {
    const baseMap = createMockMapView();
    const mockCtx = createMockCanvasContext();

    renderMap(
      mockCtx,
      {
        ...baseMap,
        playerPosition: { x: 11, y: 10 },
        cells: baseMap.cells.map((cell) => ({ ...cell, spriteName: undefined })),
        entities: [],
      },
      11,
      10,
      1,
      1,
      [],
      [],
      [],
      [],
      {},
      { x: CELL_SIZE, y: 0 },
    );

    expect(mockCtx.translate).toHaveBeenNthCalledWith(1, CELL_SIZE, 0);
    expect(mockCtx.fillText).toHaveBeenCalledTimes(2);
  });

  it('applies move secondary offsets and squash/stretch scale', () => {
    const baseMap = createMockMapView();
    const mockCtx = createMockCanvasContext();
    const move = {
      id: 'move-1',
      entityId: 'enemy-1',
      fromPos: { x: 10, y: 10 },
      toPos: { x: 11, y: 10 },
      style: 'dart' as const,
      progress: 0.1,
      fromOffsetPx: { x: -2, y: 0 },
    };
    const map: MapView = {
      ...baseMap,
      playerPosition: { x: 11, y: 10 },
      cells: baseMap.cells.map((cell) => ({ ...cell, spriteName: undefined })),
      entities: [
        {
          id: 'enemy-1',
          type: 'enemy',
          x: 11,
          y: 10,
          color: '#f00',
          ascii: 'e',
          name: 'Enemy',
          templateId: 'goblin',
        },
      ],
    };

    renderMap(mockCtx, map, 0, 0, 30, 22, [], [move]);

    const offset = moveStyleProfiles.getMoveRenderedOffsetPx(move, CELL_SIZE, 'enemy-1');
    const scale = moveStyleProfiles.getSquashStretchScale('dart', 0.1);
    const translateCalls = vi.mocked(mockCtx.translate).mock.calls;
    const entityTranslate = translateCalls[1]!;

    expect(entityTranslate[0]).toBeCloseTo((11 * CELL_SIZE) + offset.x + (CELL_SIZE / 2));
    expect(entityTranslate[1]).toBeCloseTo((10 * CELL_SIZE) + offset.y + (CELL_SIZE / 2));
    expect(mockCtx.font).toBe(`${Math.max((CELL_SIZE * Math.min(scale.scaleX, scale.scaleY)) - 2, 1)}px monospace`);
  });

  it('applies phase-aware step squash/stretch scale', () => {
    const baseMap = createMockMapView();
    const mockCtx = createMockCanvasContext();
    const move = {
      id: 'move-step-1',
      entityId: 'enemy-1',
      fromPos: { x: 10, y: 10 },
      toPos: { x: 11, y: 10 },
      style: 'step' as const,
      progress: 0.2,
      walkPhase: 'middle' as const,
    };
    const map: MapView = {
      ...baseMap,
      cells: baseMap.cells.map((cell) => ({ ...cell, spriteName: undefined })),
      entities: [
        {
          id: 'enemy-1',
          type: 'enemy',
          x: 11,
          y: 10,
          color: '#f00',
          ascii: 'e',
          name: 'Enemy',
          templateId: 'goblin',
        },
      ],
    };

    const phaseScale = moveStyleProfiles.getSquashStretchScale(move.style, move.progress, move.walkPhase);
    const defaultScale = moveStyleProfiles.getSquashStretchScale(move.style, move.progress);
    expect(phaseScale).not.toEqual(defaultScale);

    renderMap(mockCtx, map, 0, 0, 30, 22, [], [move]);

    expect(mockCtx.font).toBe(
      `${Math.max((CELL_SIZE * Math.min(phaseScale.scaleX, phaseScale.scaleY)) - 2, 1)}px monospace`,
    );
  });
});

// ── Fixture IDs — local constants, no live @dungeon/content import ────────────
// These mirror the string literals from packages/content/src/animation-refs/self.ts
// but are intentionally inlined here to keep unit tests isolated.
const FIXTURE_HEALING_PULSE_ID = 'fx.self.healing-pulse';
const FIXTURE_CURE_SPARKLE_ID  = 'fx.self.cure-sparkle';
const FIXTURE_STAMINA_SURGE_ID = 'fx.self.stamina-surge';

/** Minimal ConsumableAnimationState fixture with a heal_hearts presentation. */
function makeHealAnim(animationId?: string) {
  return {
    id: `consumable-${animationId ?? 'none'}`,
    effect: 'heal' as const,
    playerPos: { x: 10, y: 10 },
    blastPositions: [] as { x: number; y: number }[],
    startTime: 0,
    progress: 0.5,
    durationMs: 1200,
    presentation: { kind: 'heal_hearts' as const, durationMs: 1200 },
    animationId,
  };
}

/** Minimal ConsumableAnimationState fixture with a buff_rings presentation. */
function makeBuffAnim(animationId?: string) {
  return {
    id: `consumable-buff-${animationId ?? 'none'}`,
    effect: 'buff' as const,
    playerPos: { x: 10, y: 10 },
    blastPositions: [] as { x: number; y: number }[],
    startTime: 0,
    progress: 0.5,
    durationMs: 900,
    presentation: { kind: 'buff_rings' as const, durationMs: 900 },
    animationId,
  };
}

describe('canvas-renderer skipHandledAnimationIds', () => {
  function createMockCanvasContext(): CanvasRenderingContext2D {
    return {
      clearRect: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      globalAlpha: 1,
      strokeStyle: '',
      lineWidth: 0,
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      font: '',
      textAlign: 'center' as const,
      textBaseline: 'middle' as const,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }

  function createMinimalMap(): MapView {
    return {
      width: 20,
      height: 20,
      playerPosition: { x: 10, y: 10 },
      biomeId: 'dungeon',
      dangerLevel: 'safe' as const,
      cells: [],
      entities: [],
    };
  }

  it('draws a consumable animation when skipHandledAnimationIds is empty', () => {
    const map = createMinimalMap();
    const mockCtx = createMockCanvasContext();
    const anim = makeHealAnim(FIXTURE_HEALING_PULSE_ID);

    renderMap(
      mockCtx, map, 0, 0, 20, 20,
      [], [], [anim], [], {}, { x: 0, y: 0 }, [],
    );

    // save/restore bracket from drawConsumableEffects proves the animation was processed
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('draws a consumable animation when skipHandledAnimationIds is undefined', () => {
    const map = createMinimalMap();
    const mockCtx = createMockCanvasContext();
    const anim = makeHealAnim(FIXTURE_HEALING_PULSE_ID);

    renderMap(
      mockCtx, map, 0, 0, 20, 20,
      [], [], [anim], [], {},
    );

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('skips a consumable animation whose animationId is in skipHandledAnimationIds', () => {
    const map = createMinimalMap();
    const mockCtx = createMockCanvasContext();
    const anim = makeHealAnim(FIXTURE_HEALING_PULSE_ID);

    // Count save calls from the outer ctx.save()/restore() wrapping the cell+entity loop.
    // Record baseline with no consumable animations.
    renderMap(mockCtx, map, 0, 0, 20, 20, [], [], [], [], {}, { x: 0, y: 0 }, []);
    const baselineSaveCalls = vi.mocked(mockCtx.save).mock.calls.length;

    vi.mocked(mockCtx.save).mockClear();
    vi.mocked(mockCtx.restore).mockClear();

    renderMap(
      mockCtx, map, 0, 0, 20, 20,
      [], [], [anim], [],
      {}, { x: 0, y: 0 },
      [FIXTURE_HEALING_PULSE_ID],
    );

    // No additional save() beyond the outer translate bracket — consumable was skipped
    expect(vi.mocked(mockCtx.save).mock.calls.length).toBe(baselineSaveCalls);
  });

  it('skips only the handled ID and draws unhandled consumable animations normally', () => {
    const map = createMinimalMap();
    const mockCtx = createMockCanvasContext();
    const skippedAnim = makeHealAnim(FIXTURE_HEALING_PULSE_ID);
    const drawnAnim   = makeBuffAnim(FIXTURE_CURE_SPARKLE_ID);

    // Baseline: two animations, nothing skipped
    renderMap(mockCtx, map, 0, 0, 20, 20, [], [], [skippedAnim, drawnAnim], [], {}, { x: 0, y: 0 }, []);
    const saveCallsWithBoth = vi.mocked(mockCtx.save).mock.calls.length;

    vi.mocked(mockCtx.save).mockClear();
    vi.mocked(mockCtx.restore).mockClear();

    // Now skip only the healing-pulse — cure-sparkle should still draw
    renderMap(
      mockCtx, map, 0, 0, 20, 20,
      [], [], [skippedAnim, drawnAnim], [],
      {}, { x: 0, y: 0 },
      [FIXTURE_HEALING_PULSE_ID],
    );
    const saveCallsWithOneSkipped = vi.mocked(mockCtx.save).mock.calls.length;

    // Skipping one animation reduces save() calls by exactly one
    expect(saveCallsWithOneSkipped).toBe(saveCallsWithBoth - 1);
  });

  it('skips multiple handled IDs in the same render call', () => {
    const map = createMinimalMap();
    const mockCtx = createMockCanvasContext();
    const anim1 = makeHealAnim(FIXTURE_HEALING_PULSE_ID);
    const anim2 = makeBuffAnim(FIXTURE_CURE_SPARKLE_ID);
    const anim3 = makeHealAnim(FIXTURE_STAMINA_SURGE_ID);

    // Baseline: all three drawn
    renderMap(mockCtx, map, 0, 0, 20, 20, [], [], [anim1, anim2, anim3], [], {}, { x: 0, y: 0 }, []);
    const baselineSaves = vi.mocked(mockCtx.save).mock.calls.length;

    vi.mocked(mockCtx.save).mockClear();
    vi.mocked(mockCtx.restore).mockClear();

    // Skip two of the three
    renderMap(
      mockCtx, map, 0, 0, 20, 20,
      [], [], [anim1, anim2, anim3], [],
      {}, { x: 0, y: 0 },
      [FIXTURE_HEALING_PULSE_ID, FIXTURE_CURE_SPARKLE_ID],
    );
    const savesWithTwoSkipped = vi.mocked(mockCtx.save).mock.calls.length;

    expect(savesWithTwoSkipped).toBe(baselineSaves - 2);
  });

  it('uses exact ID matching — a similar but different ID is not skipped', () => {
    const map = createMinimalMap();
    const mockCtx = createMockCanvasContext();
    // 'fx.self.healing' is a prefix of 'fx.self.healing-pulse' but is NOT the same ID
    const similarButDifferentId = 'fx.self.healing';
    const anim = makeHealAnim(FIXTURE_HEALING_PULSE_ID);

    // Baseline with no skip
    renderMap(mockCtx, map, 0, 0, 20, 20, [], [], [anim], [], {});
    const baselineSaves = vi.mocked(mockCtx.save).mock.calls.length;

    vi.mocked(mockCtx.save).mockClear();
    vi.mocked(mockCtx.restore).mockClear();

    // Skipping the prefix-like ID should NOT skip the full healing-pulse animation
    renderMap(
      mockCtx, map, 0, 0, 20, 20,
      [], [], [anim], [],
      {}, { x: 0, y: 0 }, [similarButDifferentId],
    );

    expect(vi.mocked(mockCtx.save).mock.calls.length).toBe(baselineSaves);
  });

  it('does not skip an animation with no animationId even if skip list is populated', () => {
    const map = createMinimalMap();
    const mockCtx = createMockCanvasContext();
    // No animationId — legacy heal_hearts path
    const anim = makeHealAnim(undefined);

    renderMap(mockCtx, map, 0, 0, 20, 20, [], [], [anim], [], {});
    const baselineSaves = vi.mocked(mockCtx.save).mock.calls.length;

    vi.mocked(mockCtx.save).mockClear();
    vi.mocked(mockCtx.restore).mockClear();

    renderMap(
      mockCtx, map, 0, 0, 20, 20,
      [], [], [anim], [],
      {}, { x: 0, y: 0 }, [FIXTURE_HEALING_PULSE_ID, FIXTURE_CURE_SPARKLE_ID],
    );

    // Animation without animationId is unaffected by the skip list
    expect(vi.mocked(mockCtx.save).mock.calls.length).toBe(baselineSaves);
  });
});
