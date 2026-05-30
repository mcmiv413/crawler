import { describe, expect, it, vi } from 'vitest';
import { createParticleBurst } from './particle-burst.js';

const BASE_OPTIONS = {
  count: 10,
  spreadPx: 48,
  startColor: 0xff0000,
  tileSize: 16,
} as const;

describe('createParticleBurst', () => {
  it('returns object, geometry, and material', () => {
    const burst = createParticleBurst(BASE_OPTIONS);
    expect(burst.object).toBeDefined();
    expect(burst.geometry).toBeDefined();
    expect(burst.material).toBeDefined();
  });

  it('position attribute length equals count * 3', () => {
    const count = 12;
    const burst = createParticleBurst({ ...BASE_OPTIONS, count });
    const attr = burst.geometry.attributes['position'];
    expect(attr!.array.length).toBe(count * 3);
  });

  it('update does not throw at progress 0, 0.5, and 1', () => {
    const burst = createParticleBurst(BASE_OPTIONS);
    expect(() => burst.update(0)).not.toThrow();
    expect(() => burst.update(0.5)).not.toThrow();
    expect(() => burst.update(1)).not.toThrow();
  });

  it('same seed produces identical first 3 position values after update(0.5)', () => {
    const opts = { ...BASE_OPTIONS, seed: 42 };
    const burst1 = createParticleBurst(opts);
    const burst2 = createParticleBurst(opts);

    burst1.update(0.5);
    burst2.update(0.5);

    const pos1 = burst1.geometry.attributes['position']!.array;
    const pos2 = burst2.geometry.attributes['position']!.array;

    expect(pos1[0]).toBe(pos2[0]);
    expect(pos1[1]).toBe(pos2[1]);
    expect(pos1[2]).toBe(pos2[2]);
  });

  it('double-dispose only calls geometry.dispose and material.dispose once each', () => {
    const burst = createParticleBurst(BASE_OPTIONS);
    const geoSpy = vi.spyOn(burst.geometry, 'dispose');
    const matSpy = vi.spyOn(burst.material, 'dispose');

    burst.dispose();
    burst.dispose();

    expect(geoSpy).toHaveBeenCalledTimes(1);
    expect(matSpy).toHaveBeenCalledTimes(1);
  });
});
