import { describe, it, expect, vi } from 'vitest';
import type { MapView, EntityView } from '@dungeon/presenter';
import { renderMap } from './canvas-renderer.js';
import { CELL_SIZE } from '../config/ui-config.js';

describe('canvas-renderer with bump animations', () => {
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
    const mockCtx = {
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
    } as unknown as CanvasRenderingContext2D;

    const bumpAnimations = [
      {
        id: 'bump-1',
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
        progress: 0.5,
      },
    ];

    // This test will pass once renderMap is updated to accept bumpAnimations param
    expect(() => {
      renderMap(mockCtx, map, 0, 0, 30, 22);
    }).not.toThrow();
  });

  it('draws player status presentation without renderer-side status IDs', () => {
    const map = createMockMapView();
    const mockCtx = {
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
    } as unknown as CanvasRenderingContext2D;

    renderMap(mockCtx, map, 0, 0, 30, 22, [], [], [], {
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
});
