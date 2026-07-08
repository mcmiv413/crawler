/**
 * Test layer: unit
 * Behavior: screenToGrid floors canvas offsets by cell size and adds viewport offsets to produce grid coordinates.
 * Proof: Assertions expect { x: 5, y: 10 }, { x: 15, y: 8 }, and boundary results { x: 0, y: 0 } at 15px and { x: 1, y: 1 } at 16px.
 * Validation: pnpm vitest run apps/web/src/utils/screen-to-grid.test.ts
 */
import { describe, it, expect } from 'vitest';
import { screenToGrid } from './screen-to-grid.js';

describe('screenToGrid', () => {
  it('converts (0,0) click to viewport origin', () => {
    expect(screenToGrid(0, 0, 5, 10, 16)).toEqual({ x: 5, y: 10 });
  });

  it('converts mid-canvas click correctly', () => {
    // offsetX=160, offsetY=80 with cellSize=16 → pixel cell (10, 5)
    // Plus viewport offset (5, 3) → grid (15, 8)
    expect(screenToGrid(160, 80, 5, 3, 16)).toEqual({ x: 15, y: 8 });
  });

  it('handles edge of viewport', () => {
    // Just inside cell boundary: 15px with cellSize=16 → pixel cell 0
    expect(screenToGrid(15, 15, 0, 0, 16)).toEqual({ x: 0, y: 0 });
    // First pixel of next cell: 16px → pixel cell 1
    expect(screenToGrid(16, 16, 0, 0, 16)).toEqual({ x: 1, y: 1 });
  });
});
