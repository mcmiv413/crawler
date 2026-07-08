/**
 * Test layer: unit
 * Behavior: Three Coordinate Utils covers tileCenterWorld; places tile (0,0) center at (halfTile, halfTile); places tile (1,0) center one full tile to the right.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/rendering/three/three-coordinate-utils.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  tileCenterWorld,
  worldToScreen,
  isOffViewport,
} from './three-coordinate-utils.js';

// Use a fixed tile size throughout — tests must not import live ui-config.
const TILE = 16;

// ---------------------------------------------------------------------------
// tileCenterWorld
// ---------------------------------------------------------------------------
describe('tileCenterWorld', () => {
  it('places tile (0,0) center at (halfTile, halfTile)', () => {
    const { x, y } = tileCenterWorld(0, 0, TILE);
    expect(x).toBe(TILE / 2);  // 8
    expect(y).toBe(TILE / 2);  // 8
  });

  it('places tile (1,0) center one full tile to the right', () => {
    const { x, y } = tileCenterWorld(1, 0, TILE);
    expect(x).toBe(TILE + TILE / 2);  // 24
    expect(y).toBe(TILE / 2);          // 8
  });

  it('places tile (0,1) center one full tile down', () => {
    const { x, y } = tileCenterWorld(0, 1, TILE);
    expect(x).toBe(TILE / 2);          // 8
    expect(y).toBe(TILE + TILE / 2);   // 24
  });

  it('places tile (3,4) center at expected world coordinates', () => {
    const { x, y } = tileCenterWorld(3, 4, TILE);
    expect(x).toBe(3 * TILE + TILE / 2);  // 56
    expect(y).toBe(4 * TILE + TILE / 2);  // 72
  });

  it('produces integer coordinates for even tile sizes', () => {
    const { x, y } = tileCenterWorld(7, 7, TILE);
    expect(Number.isInteger(x)).toBe(true);
    expect(Number.isInteger(y)).toBe(true);
  });

  it('handles large tile coordinates without overflow', () => {
    const { x, y } = tileCenterWorld(1000, 1000, TILE);
    expect(x).toBe(1000 * TILE + TILE / 2);
    expect(y).toBe(1000 * TILE + TILE / 2);
  });

  it('handles a non-power-of-two tile size (24px)', () => {
    const TILE24 = 24;
    const { x, y } = tileCenterWorld(2, 3, TILE24);
    expect(x).toBe(2 * TILE24 + TILE24 / 2);  // 60
    expect(y).toBe(3 * TILE24 + TILE24 / 2);  // 84
  });
});

// ---------------------------------------------------------------------------
// worldToScreen
// ---------------------------------------------------------------------------
//
// Converts a world-space position (game coords, y+ = down) to screen-space
// (pixels from canvas top-left) accounting for:
//   - viewport top-left in tile coordinates (vpLeft, vpTop)
//   - camera pan/zoom offset in pixels (cameraOffset)
//
// Formula (x axis):
//   screenX = worldX - vpLeft * TILE + cameraOffset.x
//
// Formula (y axis — y+ is down in both game and screen space):
//   screenY = worldY - vpTop * TILE + cameraOffset.y
//
// The y-flip for Three.js (y+ = up) is a separate concern applied when
// positioning objects in the Three scene, NOT in this utility.

describe('worldToScreen', () => {
  it('returns (0, 0) when world position equals viewport origin with no camera offset', () => {
    // vpLeft=5 tiles, vpTop=3 tiles → viewport origin in world px = (80, 48)
    const worldX = 5 * TILE;
    const worldY = 3 * TILE;
    const { x, y } = worldToScreen(worldX, worldY, 5, 3, TILE, { x: 0, y: 0 });
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('offsets correctly when world position is one tile right of viewport origin', () => {
    const { x, y } = worldToScreen(
      6 * TILE, 3 * TILE,  // one tile right of vpLeft=5
      5, 3,
      TILE,
      { x: 0, y: 0 },
    );
    expect(x).toBe(TILE);  // 16px right
    expect(y).toBe(0);
  });

  it('offsets correctly when world position is one tile below viewport origin', () => {
    const { x, y } = worldToScreen(
      5 * TILE, 4 * TILE,  // one tile below vpTop=3
      5, 3,
      TILE,
      { x: 0, y: 0 },
    );
    expect(x).toBe(0);
    expect(y).toBe(TILE);  // 16px down
  });

  it('applies positive camera offset (pan right/down)', () => {
    const { x, y } = worldToScreen(
      5 * TILE, 3 * TILE,
      5, 3,
      TILE,
      { x: 8, y: 4 },
    );
    expect(x).toBe(8);
    expect(y).toBe(4);
  });

  it('applies negative camera offset (pan left/up)', () => {
    const { x, y } = worldToScreen(
      5 * TILE, 3 * TILE,
      5, 3,
      TILE,
      { x: -8, y: -4 },
    );
    expect(x).toBe(-8);
    expect(y).toBe(-4);
  });

  it('works with viewport starting at (0, 0)', () => {
    const { x, y } = worldToScreen(3 * TILE, 2 * TILE, 0, 0, TILE, { x: 0, y: 0 });
    expect(x).toBe(3 * TILE);  // 48
    expect(y).toBe(2 * TILE);  // 32
  });

  it('positions the tile center on-screen correctly', () => {
    // World center of tile (7, 4) with viewport at (5, 3)
    const { x: worldX, y: worldY } = tileCenterWorld(7, 4, TILE);
    const { x, y } = worldToScreen(worldX, worldY, 5, 3, TILE, { x: 0, y: 0 });
    // Tile (7,4) is 2 tiles right and 1 tile down from viewport origin (5,3)
    expect(x).toBeCloseTo(2 * TILE + TILE / 2);  // 40
    expect(y).toBeCloseTo(1 * TILE + TILE / 2);  // 24
  });

  it('combines viewport offset and camera offset additively', () => {
    const { x, y } = worldToScreen(
      10 * TILE, 8 * TILE,
      5, 3,
      TILE,
      { x: 10, y: -5 },
    );
    // base screen: (5*TILE, 5*TILE) → (80, 80) + camera (10, -5)
    expect(x).toBe(5 * TILE + 10);
    expect(y).toBe(5 * TILE - 5);
  });
});

// ---------------------------------------------------------------------------
// y-axis behavior
// ---------------------------------------------------------------------------
//
// The game uses y+ = down (canvas convention). Three.js uses y+ = up.
// worldToScreen must NOT flip y — it converts to canvas/screen space.
// The Three.js scene layer is responsible for flipping when placing meshes.
// These tests verify the y-down contract is preserved in worldToScreen.

describe('y-axis: game uses y+ = down (canvas convention)', () => {
  it('increasing tile y moves screen position downward (positive y)', () => {
    const { y: y0 } = worldToScreen(0, 0 * TILE, 0, 0, TILE, { x: 0, y: 0 });
    const { y: y1 } = worldToScreen(0, 1 * TILE, 0, 0, TILE, { x: 0, y: 0 });
    const { y: y2 } = worldToScreen(0, 2 * TILE, 0, 0, TILE, { x: 0, y: 0 });

    expect(y1).toBeGreaterThan(y0);
    expect(y2).toBeGreaterThan(y1);
  });

  it('a tile further south in the game world maps to a larger screenY', () => {
    const north = worldToScreen(5 * TILE, 3 * TILE, 5, 3, TILE, { x: 0, y: 0 });
    const south = worldToScreen(5 * TILE, 5 * TILE, 5, 3, TILE, { x: 0, y: 0 });
    expect(south.y).toBeGreaterThan(north.y);
  });

  it('screenY difference equals tile row difference * TILE size', () => {
    const a = worldToScreen(0, 3 * TILE, 0, 0, TILE, { x: 0, y: 0 });
    const b = worldToScreen(0, 7 * TILE, 0, 0, TILE, { x: 0, y: 0 });
    expect(b.y - a.y).toBe(4 * TILE);
  });

  it('x-axis is unaffected by y-axis changes', () => {
    const a = worldToScreen(2 * TILE, 0 * TILE, 0, 0, TILE, { x: 0, y: 0 });
    const b = worldToScreen(2 * TILE, 5 * TILE, 0, 0, TILE, { x: 0, y: 0 });
    expect(a.x).toBe(b.x);
  });
});

// ---------------------------------------------------------------------------
// isOffViewport
// ---------------------------------------------------------------------------
//
// Returns true when a screen-space position falls outside the visible
// canvas area defined by (0, 0) → (vpPixelWidth, vpPixelHeight).
// Used to skip rendering effects for off-screen positions.

describe('isOffViewport', () => {
  // Viewport: 30 tiles × 22 tiles at TILE=16 → 480 × 352 px
  const VP_TILES_W = 30;
  const VP_TILES_H = 22;
  const vpPxW = VP_TILES_W * TILE;
  const vpPxH = VP_TILES_H * TILE;

  it('returns false for a position at canvas origin (0, 0)', () => {
    expect(isOffViewport(0, 0, vpPxW, vpPxH)).toBe(false);
  });

  it('returns false for a position in the centre of the viewport', () => {
    expect(isOffViewport(vpPxW / 2, vpPxH / 2, vpPxW, vpPxH)).toBe(false);
  });

  it('returns false for a position at the last valid pixel (bottom-right corner)', () => {
    expect(isOffViewport(vpPxW - 1, vpPxH - 1, vpPxW, vpPxH)).toBe(false);
  });

  it('returns true when x equals vpPixelWidth (one past right edge)', () => {
    expect(isOffViewport(vpPxW, 0, vpPxW, vpPxH)).toBe(true);
  });

  it('returns true when y equals vpPixelHeight (one past bottom edge)', () => {
    expect(isOffViewport(0, vpPxH, vpPxW, vpPxH)).toBe(true);
  });

  it('returns true for negative x (left of canvas)', () => {
    expect(isOffViewport(-1, vpPxH / 2, vpPxW, vpPxH)).toBe(true);
  });

  it('returns true for negative y (above canvas)', () => {
    expect(isOffViewport(vpPxW / 2, -1, vpPxW, vpPxH)).toBe(true);
  });

  it('returns true for a position far to the right', () => {
    expect(isOffViewport(vpPxW + 100, vpPxH / 2, vpPxW, vpPxH)).toBe(true);
  });

  it('returns true for a position far below', () => {
    expect(isOffViewport(vpPxW / 2, vpPxH + 100, vpPxW, vpPxH)).toBe(true);
  });

  it('returns true when both x and y are negative', () => {
    expect(isOffViewport(-32, -32, vpPxW, vpPxH)).toBe(true);
  });

  it('returns true when both dimensions exceed the viewport', () => {
    expect(isOffViewport(vpPxW + 1, vpPxH + 1, vpPxW, vpPxH)).toBe(true);
  });

  it('uses the provided viewport dimensions, not hardcoded values', () => {
    // Tiny 1×1 viewport in px
    expect(isOffViewport(0, 0, 1, 1)).toBe(false);
    expect(isOffViewport(1, 0, 1, 1)).toBe(true);
    expect(isOffViewport(0, 1, 1, 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases and integration
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('tileCenterWorld at (0,0) with TILE=1 returns (0.5, 0.5)', () => {
    const { x, y } = tileCenterWorld(0, 0, 1);
    expect(x).toBe(0.5);
    expect(y).toBe(0.5);
  });

  it('worldToScreen with zero tile size does not throw', () => {
    // Degenerate input: zero tile size. The function should not throw;
    // results may be NaN/Infinity but the call must be safe.
    expect(() => worldToScreen(0, 0, 0, 0, 0, { x: 0, y: 0 })).not.toThrow();
  });

  it('tileCenterWorld grid position (0,0) lands inside viewport at vpLeft=0, vpTop=0', () => {
    const { x: worldX, y: worldY } = tileCenterWorld(0, 0, TILE);
    const screen = worldToScreen(worldX, worldY, 0, 0, TILE, { x: 0, y: 0 });
    const vpPxW = 30 * TILE;
    const vpPxH = 22 * TILE;
    expect(isOffViewport(screen.x, screen.y, vpPxW, vpPxH)).toBe(false);
  });

  it('a tile many columns outside viewport is detected as off-screen', () => {
    const VP_TILES_W = 30;
    const VP_TILES_H = 22;
    // Tile at column 50 — well past the right edge of a 30-tile-wide viewport
    const { x: worldX, y: worldY } = tileCenterWorld(50, 0, TILE);
    const screen = worldToScreen(worldX, worldY, 0, 0, TILE, { x: 0, y: 0 });
    expect(isOffViewport(screen.x, screen.y, VP_TILES_W * TILE, VP_TILES_H * TILE)).toBe(true);
  });

  it('camera offset alone can push an in-viewport tile off-screen', () => {
    // Tile (0,0) is at screen (8, 8) with no offset.
    // A large negative x camera offset should push it off the left edge.
    const { x: worldX, y: worldY } = tileCenterWorld(0, 0, TILE);
    const screen = worldToScreen(worldX, worldY, 0, 0, TILE, { x: -(TILE * 2), y: 0 });
    expect(isOffViewport(screen.x, screen.y, 30 * TILE, 22 * TILE)).toBe(true);
  });

  it('viewport starting at non-zero position shifts all screen coordinates', () => {
    // Both calls use the same world position but different viewport origins.
    const worldX = 10 * TILE;
    const worldY = 8 * TILE;
    const atOrigin = worldToScreen(worldX, worldY, 0, 0, TILE, { x: 0, y: 0 });
    const atOffset = worldToScreen(worldX, worldY, 5, 3, TILE, { x: 0, y: 0 });
    // Moving the viewport origin right/down should move the screen position left/up
    expect(atOffset.x).toBeLessThan(atOrigin.x);
    expect(atOffset.y).toBeLessThan(atOrigin.y);
    expect(atOrigin.x - atOffset.x).toBe(5 * TILE);
    expect(atOrigin.y - atOffset.y).toBe(3 * TILE);
  });
});
