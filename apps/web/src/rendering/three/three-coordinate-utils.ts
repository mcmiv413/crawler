/**
 * Pure coordinate-conversion utilities for the Three.js overlay.
 *
 * NO Three.js imports — all functions are plain arithmetic so they can be
 * unit-tested without a WebGL context.
 *
 * Y-axis convention
 * -----------------
 * The game world uses y+ = down (canvas/screen convention).
 * These helpers convert between world space and screen/canvas space while
 * preserving that convention.  The Three.js scene layer is responsible for
 * flipping y (y+ = up in Three) when placing meshes — that flip is NOT done
 * here.
 *
 * Viewport semantics
 * ------------------
 * vpLeft / vpTop are the top-left corner of the visible area expressed in
 * tile coordinates (not pixels).  Multiplying by tileSize gives the world-
 * space pixel origin of the viewport.
 */

/**
 * Returns the world-space centre of a tile.
 *
 * @param gridX   Tile column (0-based, x+ = right)
 * @param gridY   Tile row    (0-based, y+ = down)
 * @param tileSize Size of one tile in world pixels
 */
export function tileCenterWorld(
  gridX: number,
  gridY: number,
  tileSize: number,
): { x: number; y: number } {
  return {
    x: gridX * tileSize + tileSize / 2,
    y: gridY * tileSize + tileSize / 2,
  };
}

/**
 * Converts a world-space position to screen/canvas-space pixels.
 *
 * Formula:
 *   screenX = worldX - vpLeft * tileSize + cameraOffset.x
 *   screenY = worldY - vpTop  * tileSize + cameraOffset.y
 *
 * @param worldX       World-space x coordinate (pixels)
 * @param worldY       World-space y coordinate (pixels, y+ = down)
 * @param vpLeft       Viewport left edge in tile coordinates
 * @param vpTop        Viewport top  edge in tile coordinates
 * @param tileSize     Size of one tile in world pixels
 * @param cameraOffset Additional pan/zoom offset in screen pixels
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  vpLeft: number,
  vpTop: number,
  tileSize: number,
  cameraOffset: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: worldX - vpLeft * tileSize + cameraOffset.x,
    y: worldY - vpTop  * tileSize + cameraOffset.y,
  };
}

/**
 * Returns true when the screen-space position falls outside the canvas area
 * defined by (0, 0) → (vpPixelWidth, vpPixelHeight).
 *
 * Boundary semantics: coordinates equal to the width/height are considered
 * outside (half-open interval [0, vpPixelWidth) × [0, vpPixelHeight)).
 *
 * @param screenX      Screen x coordinate (pixels from canvas left)
 * @param screenY      Screen y coordinate (pixels from canvas top)
 * @param vpPixelWidth  Canvas width in pixels
 * @param vpPixelHeight Canvas height in pixels
 */
export function isOffViewport(
  screenX: number,
  screenY: number,
  vpPixelWidth: number,
  vpPixelHeight: number,
): boolean {
  return (
    screenX < 0 ||
    screenY < 0 ||
    screenX >= vpPixelWidth ||
    screenY >= vpPixelHeight
  );
}
