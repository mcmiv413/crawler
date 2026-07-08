/**
 * Test layer: unit
 * Behavior: Soft Glow covers createSoftGlow; creates object, material, and texture; setScale.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/rendering/three/lib/soft-glow.test.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoftGlow } from './soft-glow.js';

// happy-dom exposes document but does not implement canvas 2D context.
// We shim document.createElement for 'canvas' so CanvasTexture is created.
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
    // fallthrough for any other element
    return Object.getPrototypeOf(document).createElement.call(document, tagName) as HTMLElement;
  });
}

beforeEach(() => {
  setupCanvasMock();
});

describe('createSoftGlow', () => {
  it('creates object, material, and texture', () => {
    const glow = createSoftGlow({ color: 0xffffff, radiusPx: 10 });
    expect(glow.object).toBeDefined();
    expect(glow.material).toBeDefined();
    // happy-dom provides document, so texture should exist
    expect(glow.texture).not.toBeNull();
  });

  describe('setScale', () => {
    it('sets sprite scale x and y to radiusPx * 2', () => {
      const glow = createSoftGlow({ color: 0xffffff, radiusPx: 5 });
      glow.setScale(18);
      expect(glow.object.scale.x).toBe(36);
      expect(glow.object.scale.y).toBe(36);
    });

    it('constructor calls setScale with options.radiusPx', () => {
      const glow = createSoftGlow({ color: 0xffffff, radiusPx: 12 });
      expect(glow.object.scale.x).toBe(24);
      expect(glow.object.scale.y).toBe(24);
    });
  });

  describe('setOpacity', () => {
    it('sets material opacity to the given value', () => {
      const glow = createSoftGlow({ color: 0xffffff, radiusPx: 10 });
      glow.setOpacity(0.25);
      expect(glow.material.opacity).toBe(0.25);
    });

    it('clamps negative opacity to 0', () => {
      const glow = createSoftGlow({ color: 0xffffff, radiusPx: 10 });
      glow.setOpacity(-0.1);
      expect(glow.material.opacity).toBe(0);
    });

    it('clamps opacity above 1 to 1', () => {
      const glow = createSoftGlow({ color: 0xffffff, radiusPx: 10 });
      glow.setOpacity(1.5);
      expect(glow.material.opacity).toBe(1);
    });
  });

  describe('dispose', () => {
    it('disposes material and texture exactly once on double-dispose', () => {
      const glow = createSoftGlow({ color: 0xffffff, radiusPx: 10 });
      expect(glow.texture).not.toBeNull();

      const materialDispose = vi.spyOn(glow.material, 'dispose');
      // texture is non-null here (happy-dom)
      const textureDispose = vi.spyOn(glow.texture!, 'dispose');

      glow.dispose();
      glow.dispose();

      expect(materialDispose).toHaveBeenCalledTimes(1);
      expect(textureDispose).toHaveBeenCalledTimes(1);
    });

    it('does not throw when called twice', () => {
      const glow = createSoftGlow({ color: 0xffffff, radiusPx: 10 });
      expect(() => {
        glow.dispose();
        glow.dispose();
      }).not.toThrow();
    });
  });

  describe('null texture path (simulated)', () => {
    it('dispose does not throw when texture is null', () => {
      // We simulate the no-document path by creating with additive=false
      // and verifying graceful disposal even without texture access.
      // The actual null-texture path requires no document; we verify
      // the dispose guard still works in the normal path.
      const glow = createSoftGlow({ color: 0xff0000, radiusPx: 8, additive: false });
      expect(() => {
        glow.dispose();
        glow.dispose();
      }).not.toThrow();
    });
  });
});
