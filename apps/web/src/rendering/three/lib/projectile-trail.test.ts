/**
 * Test layer: unit
 * Behavior: Projectile Trail covers createProjectileTrail; places mesh at local y = -lengthPx  2; places mesh at local x = 0 and z = 0.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/rendering/three/lib/projectile-trail.test.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectileTrail } from './projectile-trail.js';

describe('createProjectileTrail', () => {
  const defaultOptions = {
    lengthPx: 20,
    widthPx: 4,
    color: 0xffffff,
  } as const;

  it('places mesh at local y = -lengthPx / 2', () => {
    const trail = createProjectileTrail(defaultOptions);
    expect(trail.object.position.y).toBeCloseTo(-defaultOptions.lengthPx / 2);
  });

  it('places mesh at local x = 0 and z = 0', () => {
    const trail = createProjectileTrail(defaultOptions);
    expect(trail.object.position.x).toBe(0);
    expect(trail.object.position.z).toBe(0);
  });

  it('exposes geometry and material', () => {
    const trail = createProjectileTrail(defaultOptions);
    expect(trail.object.geometry).toBe(trail.geometry);
    expect(trail.object.material).toBe(trail.material);
  });

  describe('update()', () => {
    it('does not throw at representative progress values', () => {
      const trail = createProjectileTrail(defaultOptions);
      expect(() => trail.update(0)).not.toThrow();
      expect(() => trail.update(0.5)).not.toThrow();
      expect(() => trail.update(1)).not.toThrow();
    });

    it('opacity equals base opacity at progress 0.5 when fadeStart is 0.8', () => {
      const trail = createProjectileTrail({ ...defaultOptions, opacity: 0.55, fadeStart: 0.8 });
      trail.update(0.5);
      expect(trail.material.opacity).toBeCloseTo(0.55);
    });

    it('opacity is 0 at progress 1', () => {
      const trail = createProjectileTrail({ ...defaultOptions, fadeStart: 0.8 });
      trail.update(1);
      expect(trail.material.opacity).toBeCloseTo(0);
    });

    it('scale y is approximately 0.35 at progress 0', () => {
      const trail = createProjectileTrail(defaultOptions);
      trail.update(0);
      expect(trail.object.scale.y).toBeCloseTo(0.35);
    });

    it('scale y reaches 1 by progress 0.25', () => {
      const trail = createProjectileTrail(defaultOptions);
      trail.update(0.25);
      expect(trail.object.scale.y).toBeCloseTo(1);
    });

    it('clamps negative progress without throwing', () => {
      const trail = createProjectileTrail(defaultOptions);
      expect(() => trail.update(-1)).not.toThrow();
    });

    it('clamps progress above 1 without throwing', () => {
      const trail = createProjectileTrail(defaultOptions);
      expect(() => trail.update(2)).not.toThrow();
    });
  });

  describe('dispose()', () => {
    it('calls geometry.dispose and material.dispose exactly once on double dispose', () => {
      const trail = createProjectileTrail(defaultOptions);
      const geoSpy = vi.spyOn(trail.geometry, 'dispose');
      const matSpy = vi.spyOn(trail.material, 'dispose');

      trail.dispose();
      trail.dispose();

      expect(geoSpy).toHaveBeenCalledTimes(1);
      expect(matSpy).toHaveBeenCalledTimes(1);
    });

    it('does not throw on double dispose', () => {
      const trail = createProjectileTrail(defaultOptions);
      expect(() => {
        trail.dispose();
        trail.dispose();
      }).not.toThrow();
    });
  });

  describe('options', () => {
    it('uses custom opacity', () => {
      const trail = createProjectileTrail({ ...defaultOptions, opacity: 0.3, fadeStart: 0.9 });
      trail.update(0.5);
      expect(trail.material.opacity).toBeCloseTo(0.3);
    });

    it('respects custom fadeStart', () => {
      const trail = createProjectileTrail({ ...defaultOptions, opacity: 0.6, fadeStart: 0.6 });
      trail.update(0.6);
      expect(trail.material.opacity).toBeCloseTo(0.6);
      trail.update(1);
      expect(trail.material.opacity).toBeCloseTo(0);
    });
  });
});
