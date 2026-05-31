import { describe, expect, it } from 'vitest';
import {
  MOVE_STYLE_PROFILES,
  type WalkMotionPhase,
  applyMoveStyleEasing,
  getMoveStyleProfile,
} from './move-style-profiles.js';

describe('MOVE_STYLE_PROFILES', () => {
  it('locks the shared move style rendering table', () => {
    expect(MOVE_STYLE_PROFILES).toEqual({
      step: {
        anticipationFrac: 0,
        anticipationPx: 0,
        recoilFrac: 0,
        recoilPx: 0,
        arcAmplitude: 0,
        squashTiming: 'none',
        squashAmplitude: 0,
        jitterPx: 0,
      },
      slide: {
        anticipationFrac: 0,
        anticipationPx: 0,
        recoilFrac: 0,
        recoilPx: 0,
        arcAmplitude: 0,
        squashTiming: 'none',
        squashAmplitude: 0,
        jitterPx: 0,
      },
      dart: {
        anticipationFrac: 0,
        anticipationPx: 0,
        recoilFrac: 0,
        recoilPx: 0,
        arcAmplitude: 0,
        squashTiming: 'none',
        squashAmplitude: 0,
        jitterPx: 0,
      },
      drift: {
        anticipationFrac: 0,
        anticipationPx: 0,
        recoilFrac: 0,
        recoilPx: 0,
        arcAmplitude: 0,
        squashTiming: 'none',
        squashAmplitude: 0,
        jitterPx: 0,
      },
      stomp: {
        anticipationFrac: 0,
        anticipationPx: 0,
        recoilFrac: 0,
        recoilPx: 0,
        arcAmplitude: 0,
        squashTiming: 'none',
        squashAmplitude: 0,
        jitterPx: 0,
      },
      lurch: {
        anticipationFrac: 0,
        anticipationPx: 0,
        recoilFrac: 0,
        recoilPx: 0,
        arcAmplitude: 0,
        squashTiming: 'none',
        squashAmplitude: 0,
        jitterPx: 0,
      },
    });
  });

  it('returns the requested style profile', () => {
    expect(getMoveStyleProfile('stomp')).toBe(MOVE_STYLE_PROFILES.stomp);
    expect(getMoveStyleProfile('drift')).toBe(MOVE_STYLE_PROFILES.drift);
  });

  it('applies the spec easing curve for each movement style', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1] as const;
    const expected = {
      step: [0, 0.2295918367, 0.5, 0.7569444444, 1],
      slide: [0, 0.4375, 0.75, 0.9375, 1],
      dart: [0, 0.015625, 0.125, 0.421875, 1],
      drift: [0, 0.015625, 0.5, 0.984375, 1],
      stomp: [0, 0.8174096875, 1.0876975, 1.0641365625, 1],
      lurch: [0, 0, 0.1111111111, 0.4444444444, 1],
    } as const;

    for (const [style, values] of Object.entries(expected)) {
      samples.forEach((progress, index) => {
        expect(applyMoveStyleEasing(style as keyof typeof expected, progress)).toBeCloseTo(values[index]!, 6);
      });
    }
  });

  it('supports walk-chain phases for the shared step baseline', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1] as const;
    const expectedByPhase: Record<WalkMotionPhase, readonly number[]> = {
      single: [0, 0.2295918367, 0.5, 0.7569444444, 1],
      start: [0, 0.2295918367, 0.5, 0.75, 1],
      middle: [0, 0.25, 0.5, 0.75, 1],
      end: [0, 0.25, 0.5, 0.7569444444, 1],
    };

    for (const [walkPhase, expected] of Object.entries(expectedByPhase) as Array<[WalkMotionPhase, readonly number[]]>) {
      samples.forEach((progress, index) => {
        expect(applyMoveStyleEasing('step', progress, walkPhase)).toBeCloseTo(expected[index]!, 6);
      });
    }
  });
});
