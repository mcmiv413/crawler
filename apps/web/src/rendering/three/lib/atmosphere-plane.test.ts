/**
 * Test layer: unit
 * Behavior: createAtmosphereVignette creates a viewport-sized black vignette that works with and without canvas texture support, clamps opacity, recenters on resize, and disposes resources once.
 * Proof: Assertions check object/material/texture presence or null fallback, material color/blending/depth flags, z/renderOrder, scale and centered position after setSize, clamped opacity values, and single geometry/material/texture dispose calls.
 * Validation: pnpm vitest run apps/web/src/rendering/three/lib/atmosphere-plane.test.ts
 */
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAtmosphereVignette } from './atmosphere-plane.js';

function setupCanvasMock(): void {
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      const fakeCtx = {
        createRadialGradient: () => ({ addColorStop: (_stop: number, _color: string) => {} }),
        fillRect: (_x: number, _y: number, _w: number, _h: number) => {},
        fillStyle: '' as unknown,
      };

      return {
        width: 0,
        height: 0,
        getContext: (_type: string) => fakeCtx,
      } as unknown as HTMLCanvasElement;
    }

    return Object.getPrototypeOf(document).createElement.call(document, tagName) as HTMLElement;
  });
}

beforeEach(() => {
  setupCanvasMock();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createAtmosphereVignette', () => {
  it('creates object, material, and texture when canvas APIs are available', () => {
    const vignette = createAtmosphereVignette({ width: 320, height: 180 });

    expect(vignette.object).toBeDefined();
    expect(vignette.material).toBeDefined();
    expect(vignette.texture).not.toBeNull();
  });

  it('falls back to a null texture when document is unavailable', () => {
    vi.stubGlobal('document', undefined);

    const vignette = createAtmosphereVignette({ width: 320, height: 180 });

    expect(vignette.texture).toBeNull();
    expect(vignette.material.map).toBeNull();
  });

  it('uses a black, normal-blended material behind the scene visuals', () => {
    const vignette = createAtmosphereVignette({ width: 320, height: 180 });

    expect(vignette.material.color.getHex()).toBe(0x000000);
    expect(vignette.material.blending).toBe(THREE.NormalBlending);
    expect(vignette.material.blending).not.toBe(THREE.AdditiveBlending);
    expect(vignette.material.transparent).toBe(true);
    expect(vignette.material.depthWrite).toBe(false);
    expect(vignette.object.position.z).toBe(-1);
    expect(vignette.object.renderOrder).toBe(-100);
  });

  it('setSize updates the plane scale and centers it in viewport pixels', () => {
    const vignette = createAtmosphereVignette({ width: 100, height: 50 });

    vignette.setSize(320, 180);

    expect(vignette.object.scale.x).toBe(320);
    expect(vignette.object.scale.y).toBe(180);
    expect(vignette.object.position.x).toBe(160);
    expect(vignette.object.position.y).toBe(90);
    expect(vignette.object.position.z).toBe(-1);
  });

  it('setOpacity clamps to the inclusive [0, 1] range', () => {
    const vignette = createAtmosphereVignette({ width: 320, height: 180 });

    vignette.setOpacity(-0.25);
    expect(vignette.material.opacity).toBe(0);

    vignette.setOpacity(0.33);
    expect(vignette.material.opacity).toBe(0.33);

    vignette.setOpacity(1.5);
    expect(vignette.material.opacity).toBe(1);
  });

  it('disposes geometry, material, and texture exactly once on double-dispose', () => {
    const vignette = createAtmosphereVignette({ width: 320, height: 180 });

    const geometryDispose = vi.spyOn(vignette.object.geometry, 'dispose');
    const materialDispose = vi.spyOn(vignette.material, 'dispose');
    const textureDispose = vi.spyOn(vignette.texture!, 'dispose');

    vignette.dispose();
    vignette.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
  });
});
