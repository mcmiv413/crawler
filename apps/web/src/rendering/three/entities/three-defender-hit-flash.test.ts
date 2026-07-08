/**
 * Test layer: unit
 * Behavior: three-defender-hit-flash creates, positions, animates, and disposes the defender-hit flash mesh.
 * Proof: Asserts scene.add receives the mesh, y-axis flip positions (96, 240, 3), opacity drops while scale grows at progress 0.5, and cleanup removes the mesh and disposes geometry/material once.
 * Validation: pnpm vitest run apps/web/src/rendering/three/entities/three-defender-hit-flash.test.ts
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createDefenderHitFlash,
  disposeDefenderHitFlash,
  setDefenderHitFlashPosition,
  updateDefenderHitFlash,
} from './three-defender-hit-flash.js';

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

describe('three-defender-hit-flash', () => {
  it('creates a flash mesh and adds it to the scene', () => {
    const ctx = makeContext();
    const flash = createDefenderHitFlash(ctx);

    expect(flash.mesh).toBeDefined();
    expect(ctx.scene.add).toHaveBeenCalledWith(flash.mesh);
  });

  it('positions with the standard y-axis flip', () => {
    const ctx = makeContext(24, 360);
    const flash = createDefenderHitFlash(ctx);

    setDefenderHitFlashPosition(flash, { x: 96, y: 120, z: 3 }, ctx.canvasHeight);

    expect(flash.mesh.position.x).toBeCloseTo(96);
    expect(flash.mesh.position.y).toBeCloseTo(240);
    expect(flash.mesh.position.z).toBeCloseTo(3);
  });

  it('fades and scales over progress', () => {
    const flash = createDefenderHitFlash(makeContext());
    const initialOpacity = flash.material.opacity;

    updateDefenderHitFlash(flash, 0.5);

    expect(flash.material.opacity).toBeLessThan(initialOpacity);
    expect(flash.mesh.scale.x).toBeGreaterThan(1);
    expect(flash.mesh.scale.y).toBeGreaterThan(1);
  });

  it('removes and disposes on cleanup', () => {
    const ctx = makeContext();
    const flash = createDefenderHitFlash(ctx);
    const geometryDispose = vi.spyOn(flash.geometry, 'dispose');
    const materialDispose = vi.spyOn(flash.material, 'dispose');

    disposeDefenderHitFlash(flash, ctx.scene);

    expect(ctx.scene.remove).toHaveBeenCalledWith(flash.mesh);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });
});
