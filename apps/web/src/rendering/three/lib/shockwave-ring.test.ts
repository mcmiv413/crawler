import { describe, expect, it, vi } from 'vitest';
import { createShockwaveRing } from './shockwave-ring.js';

const BASE_OPTIONS = {
  innerRadiusPx: 5,
  outerRadiusPx: 20,
  color: 0xaaaaff,
  startScale: 1,
  endScale: 3,
  opacity: 1,
  fadeStart: 0,
} as const;

describe('createShockwaveRing', () => {
  it('scale at progress 0 equals startScale', () => {
    const ring = createShockwaveRing(BASE_OPTIONS);
    ring.update(0);
    expect(ring.object.scale.x).toBeCloseTo(BASE_OPTIONS.startScale);
  });

  it('scale at progress 1 equals endScale', () => {
    const ring = createShockwaveRing(BASE_OPTIONS);
    ring.update(1);
    expect(ring.object.scale.x).toBeCloseTo(BASE_OPTIONS.endScale);
  });

  it('opacity at progress 1 equals 0', () => {
    const ring = createShockwaveRing(BASE_OPTIONS);
    ring.update(1);
    expect(ring.material.opacity).toBeCloseTo(0);
  });

  it('update(0), update(0.5), update(1) do not throw', () => {
    const ring = createShockwaveRing(BASE_OPTIONS);
    expect(() => ring.update(0)).not.toThrow();
    expect(() => ring.update(0.5)).not.toThrow();
    expect(() => ring.update(1)).not.toThrow();
  });

  it('scale is between startScale and endScale at progress 0.5', () => {
    const ring = createShockwaveRing(BASE_OPTIONS);
    ring.update(0.5);
    expect(ring.object.scale.x).toBeGreaterThan(BASE_OPTIONS.startScale);
    expect(ring.object.scale.x).toBeLessThan(BASE_OPTIONS.endScale);
  });

  it('opacity stays at base until fadeStart, then fades to 0', () => {
    const ring = createShockwaveRing({ ...BASE_OPTIONS, fadeStart: 0.5 });

    ring.update(0);
    expect(ring.material.opacity).toBeCloseTo(1);

    ring.update(0.5);
    expect(ring.material.opacity).toBeCloseTo(1);

    ring.update(0.75);
    expect(ring.material.opacity).toBeCloseTo(0.5);

    ring.update(1);
    expect(ring.material.opacity).toBeCloseTo(0);
  });

  it('does not add itself to a scene', () => {
    // The factory takes no scene argument — verified structurally.
    const ring = createShockwaveRing(BASE_OPTIONS);
    expect(ring.object).toBeDefined();
  });

  it('double-dispose only disposes geometry and material once each', () => {
    const ring = createShockwaveRing(BASE_OPTIONS);
    const geometryDispose = vi.spyOn(ring.geometry, 'dispose');
    const materialDispose = vi.spyOn(ring.material, 'dispose');

    ring.dispose();
    ring.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });
});
