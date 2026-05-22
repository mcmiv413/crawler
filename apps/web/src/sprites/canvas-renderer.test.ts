import { describe, it, expect, vi } from 'vitest';
import type { MapView, EntityView } from '@dungeon/presenter';
import { renderMap } from './canvas-renderer.js';
import { CELL_SIZE } from '../config/ui-config.js';
import {
  getMoveRenderedOffsetPx,
  getSquashStretchScale,
} from '../animations/move-style-profiles.js';

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

    const offset = getMoveRenderedOffsetPx(move, CELL_SIZE, 'enemy-1');
    const scale = getSquashStretchScale('dart', 0.1);
    const translateCalls = vi.mocked(mockCtx.translate).mock.calls;
    const entityTranslate = translateCalls[1]!;

    expect(entityTranslate[0]).toBeCloseTo((11 * CELL_SIZE) + offset.x + (CELL_SIZE / 2));
    expect(entityTranslate[1]).toBeCloseTo((10 * CELL_SIZE) + offset.y + (CELL_SIZE / 2));
    expect(mockCtx.font).toBe(`${Math.max((CELL_SIZE * Math.min(scale.scaleX, scale.scaleY)) - 2, 1)}px monospace`);
  });
});
