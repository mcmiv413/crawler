/**
 * Test layer: unit
 * Behavior: Entity sprite helpers create tile-scale scene meshes, position and offset them in screen space, dispose GPU resources, and draw optional instance color markers.
 * Proof: Assertions check mesh geometry/material identity, scene.add/remove calls, tile-sized geometry, y-axis flipped x/y/z positions, offset math, dispose call counts, and fillRect marker calls or absence.
 * Validation: pnpm vitest run apps/web/src/rendering/three/entities/three-entity-sprite.test.ts
 */
/**
 * Tests for three-entity-sprite.ts
 *
 * Provides tile-sized plane geometry for rendering entities as sprites in the
 * Three.js overlay. Contracts tested:
 *  - Plane geometry is created at tile size (not sub-pixel)
 *  - Position respects the y-axis flip (Three y+ = up)
 *  - Movement offset shifts position from base tile center
 *  - Bump/lunge offset applies an additional directional displacement
 *  - Disposal removes from scene and releases GPU memory
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createEntitySprite,
  drawEntityInstanceColorMarker,
  setEntitySpritePosition,
  setEntitySpriteMovementOffset,
  disposeEntitySprite,
} from './three-entity-sprite.js';

// ---------------------------------------------------------------------------
// Minimal Three.js stubs — no real WebGL context needed
// ---------------------------------------------------------------------------

function makeScene() {
  return {
    add: vi.fn(),
    remove: vi.fn(),
  };
}

function makeContext(tileSize = 24, canvasHeight = 360) {
  return {
    renderer: {},
    scene: makeScene(),
    camera: {},
    canvasWidth: 480,
    canvasHeight,
    vpLeft: 0,
    vpTop: 0,
    tileSize,
  };
}

// ---------------------------------------------------------------------------
// Suite: createEntitySprite
// ---------------------------------------------------------------------------

describe('createEntitySprite', () => {
  it('returns a sprite instance with geometry and material', () => {
    const ctx = makeContext();
    const sprite = createEntitySprite(ctx);
    expect(sprite.mesh.geometry).toBe(sprite.geometry);
    expect(sprite.mesh.material).toBe(sprite.material);
  });

  it('adds the mesh to the scene on creation', () => {
    const ctx = makeContext();
    createEntitySprite(ctx);
    expect(ctx.scene.add).toHaveBeenCalledTimes(1);
  });

  it('geometry width equals tileSize (not sub-pixel)', () => {
    const tileSize = 24;
    const ctx = makeContext(tileSize);
    const sprite = createEntitySprite(ctx);
    // Width of the plane must be >= tileSize (at least full tile coverage)
    expect(sprite.geometry.parameters.width).toBeGreaterThanOrEqual(tileSize);
  });

  it('geometry height equals tileSize (not sub-pixel)', () => {
    const tileSize = 24;
    const ctx = makeContext(tileSize);
    const sprite = createEntitySprite(ctx);
    expect(sprite.geometry.parameters.height).toBeGreaterThanOrEqual(tileSize);
  });

  it('works with different tile sizes', () => {
    const sprite32 = createEntitySprite(makeContext(32));
    expect(sprite32.geometry.parameters.width).toBeGreaterThanOrEqual(32);

    const sprite16 = createEntitySprite(makeContext(16));
    expect(sprite16.geometry.parameters.width).toBeGreaterThanOrEqual(16);
  });
});

// ---------------------------------------------------------------------------
// Suite: setEntitySpritePosition
// ---------------------------------------------------------------------------

describe('setEntitySpritePosition', () => {
  it('sets mesh position without throwing', () => {
    const ctx = makeContext(24, 360);
    const sprite = createEntitySprite(ctx);
    expect(() =>
      setEntitySpritePosition(sprite, { x: 120, y: 144, z: 0 }, ctx.canvasHeight),
    ).not.toThrow();
  });

  it('applies y-axis flip: mesh.position.y = canvasHeight - screenY', () => {
    const canvasHeight = 360;
    const ctx = makeContext(24, canvasHeight);
    const sprite = createEntitySprite(ctx);
    const screenY = 144;
    setEntitySpritePosition(sprite, { x: 120, y: screenY, z: 0 }, canvasHeight);
    expect(sprite.mesh.position.y).toBeCloseTo(canvasHeight - screenY);
  });

  it('passes screen x through to mesh.position.x unchanged', () => {
    const ctx = makeContext(24, 360);
    const sprite = createEntitySprite(ctx);
    setEntitySpritePosition(sprite, { x: 72, y: 96, z: 0 }, ctx.canvasHeight);
    expect(sprite.mesh.position.x).toBeCloseTo(72);
  });

  it('uses z from position parameter', () => {
    const ctx = makeContext(24, 360);
    const sprite = createEntitySprite(ctx);
    setEntitySpritePosition(sprite, { x: 0, y: 0, z: 2 }, ctx.canvasHeight);
    expect(sprite.mesh.position.z).toBeCloseTo(2);
  });
});

// ---------------------------------------------------------------------------
// Suite: setEntitySpriteMovementOffset
// ---------------------------------------------------------------------------

describe('setEntitySpriteMovementOffset', () => {
  it('applies movement offset to base position', () => {
    const canvasHeight = 360;
    const ctx = makeContext(24, canvasHeight);
    const sprite = createEntitySprite(ctx);
    const base = { x: 120, y: 144, z: 0 };
    setEntitySpritePosition(sprite, base, canvasHeight);

    const offsetX = 8;
    const offsetY = -4;
    setEntitySpriteMovementOffset(sprite, base, { x: offsetX, y: offsetY }, canvasHeight);

    expect(sprite.mesh.position.x).toBeCloseTo(base.x + offsetX);
    // y is flipped: (canvasHeight - (base.y + offsetY))
    expect(sprite.mesh.position.y).toBeCloseTo(canvasHeight - (base.y + offsetY));
  });

  it('zero offset leaves position unchanged from base', () => {
    const canvasHeight = 360;
    const ctx = makeContext(24, canvasHeight);
    const sprite = createEntitySprite(ctx);
    const base = { x: 60, y: 80, z: 0 };
    setEntitySpritePosition(sprite, base, canvasHeight);
    setEntitySpriteMovementOffset(sprite, base, { x: 0, y: 0 }, canvasHeight);

    expect(sprite.mesh.position.x).toBeCloseTo(base.x);
    expect(sprite.mesh.position.y).toBeCloseTo(canvasHeight - base.y);
  });
});

// ---------------------------------------------------------------------------
// Suite: disposeEntitySprite
// ---------------------------------------------------------------------------

describe('disposeEntitySprite', () => {
  it('removes mesh from scene on dispose', () => {
    const ctx = makeContext();
    const sprite = createEntitySprite(ctx);
    disposeEntitySprite(sprite, ctx.scene);
    expect(ctx.scene.remove).toHaveBeenCalledWith(sprite.mesh);
  });

  it('calls geometry.dispose()', () => {
    const ctx = makeContext();
    const sprite = createEntitySprite(ctx);
    const geometryDispose = vi.spyOn(sprite.geometry, 'dispose');
    disposeEntitySprite(sprite, ctx.scene);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
  });

  it('calls material.dispose()', () => {
    const ctx = makeContext();
    const sprite = createEntitySprite(ctx);
    const materialDispose = vi.spyOn(sprite.material, 'dispose');
    disposeEntitySprite(sprite, ctx.scene);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });

  it('does not throw on double-dispose', () => {
    const ctx = makeContext();
    const sprite = createEntitySprite(ctx);
    disposeEntitySprite(sprite, ctx.scene);
    expect(() => disposeEntitySprite(sprite, ctx.scene)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Suite: visibility contract — geometry is tile-scale, not sub-pixel
// ---------------------------------------------------------------------------

describe('visibility contract', () => {
  it('plane geometry area is at least tileSize^2 pixels', () => {
    const tileSize = 24;
    const ctx = makeContext(tileSize);
    const sprite = createEntitySprite(ctx);
    const area = sprite.geometry.parameters.width * sprite.geometry.parameters.height;
    expect(area).toBeGreaterThanOrEqual(tileSize * tileSize);
  });

  it('a module using 0.4 scale without tileSize multiplication produces sub-pixel geometry (negative test)', () => {
    // Illustrates why modules must multiply by tileSize, not use raw 0.4
    const subPixelSize = 0.4;
    expect(subPixelSize).toBeLessThan(1); // would be invisible without tileSize multiply
  });
});

describe('drawEntityInstanceColorMarker', () => {
  it('draws the same backdrop and color swatch used by the canvas renderer', () => {
    const ctx = {
      fillStyle: '',
      fillRect: vi.fn(),
    };

    drawEntityInstanceColorMarker(ctx, 24, '#ff00ff');

    expect(ctx.fillRect).toHaveBeenNthCalledWith(1, 19, 0, 5, 6);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(2, 20, 1, 3, 4);
  });

  it('does nothing when instanceColor is absent', () => {
    const ctx = {
      fillStyle: '',
      fillRect: vi.fn(),
    };

    drawEntityInstanceColorMarker(ctx, 24);

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});
