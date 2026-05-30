import { describe, expect, it } from 'vitest';
import {
  clamp01,
  easeInCubic,
  easeInOutQuad,
  easeOutBack,
  easeOutCubic,
  easeOutQuad,
  lerp,
  smoothstep,
} from './easing.js';

describe('clamp01', () => {
  it('clamps values below 0 to 0', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(-0.001)).toBe(0);
  });

  it('clamps values above 1 to 1', () => {
    expect(clamp01(2)).toBe(1);
    expect(clamp01(1.001)).toBe(1);
  });

  it('passes through values in [0, 1]', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
  });
});

describe('lerp', () => {
  it('returns a at t=0 and b at t=1', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 10, 0.5)).toBeCloseTo(5);
    expect(lerp(-4, 4, 0.5)).toBeCloseTo(0);
  });

  it('clamps t outside [0, 1]', () => {
    expect(lerp(0, 10, -1)).toBe(0);
    expect(lerp(0, 10, 2)).toBe(10);
  });
});

const easingFunctions = [
  { name: 'easeOutCubic', fn: easeOutCubic },
  { name: 'easeInCubic', fn: easeInCubic },
  { name: 'easeOutQuad', fn: easeOutQuad },
  { name: 'easeInOutQuad', fn: easeInOutQuad },
  { name: 'smoothstep', fn: smoothstep },
] as const;

for (const { name, fn } of easingFunctions) {
  describe(name, () => {
    it('returns 0 at t=0 and 1 at t=1', () => {
      expect(fn(0)).toBeCloseTo(0);
      expect(fn(1)).toBeCloseTo(1);
    });

    it('clamps t outside [0, 1]', () => {
      expect(fn(-5)).toBeCloseTo(0);
      expect(fn(5)).toBeCloseTo(1);
    });

    it('is monotonically non-decreasing over [0, 0.25, 0.5, 0.75, 1]', () => {
      const samples = [0, 0.25, 0.5, 0.75, 1].map(fn);
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!);
      }
    });
  });
}

describe('easeOutBack', () => {
  it('returns 0 at t=0 and 1 at t=1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
  });

  it('clamps t outside [0, 1]', () => {
    expect(easeOutBack(-5)).toBeCloseTo(0);
    expect(easeOutBack(5)).toBeCloseTo(1);
  });

  it('overshoots above 1 near t=0.75', () => {
    expect(easeOutBack(0.75)).toBeGreaterThan(1);
  });
});
