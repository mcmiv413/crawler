/**
 * Test layer: unit
 * Behavior: Move style secondary-motion helpers keep current styles free of anticipation, recoil, jitter, and non-step squash while preserving deployed arc offsets and stomp landing dip timing.
 * Proof: Assertions check anticipation/recoil/jitter are zero for every style, squash/stretch returns step-only scale changes, arc offsets match step/slide/drift/dart/lurch samples, and stomp switches from zero to positive dip after 70 percent progress.
 * Validation: pnpm vitest run apps/web/src/animations/move-style-secondary-motion.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  getAnticipationOffsetPx,
  getJitterOffsetPx,
  getMoveArcOffsetPx,
  getRecoilOffsetPx,
  getSquashStretchScale,
} from './move-style-profiles.js';

describe('move style secondary motion', () => {
  it('keeps styles free of anticipation, recoil, jitter, and squash', () => {
    for (const style of ['step', 'slide', 'dart', 'drift', 'stomp', 'lurch'] as const) {
      expect(getAnticipationOffsetPx(style, 0.1)).toBe(0);
      expect(getRecoilOffsetPx(style, 0.92)).toBe(0);
      expect(getJitterOffsetPx(style, 0.1, 'enemy-1')).toBe(0);
      if (style === 'step') {
        expect(getSquashStretchScale(style, 0.5)).toEqual({ scaleX: 0.97, scaleY: 1.03 });
      } else {
        expect(getSquashStretchScale(style, 0.5)).toEqual({ scaleX: 1, scaleY: 1 });
      }
    }
  });

  it('matches deployed dungeon arc offsets', () => {
    expect(getMoveArcOffsetPx('step', 0.5, 24)).toBeCloseTo(-1.44);
    expect(getMoveArcOffsetPx('slide', 0.5, 24)).toBeCloseTo(-3);
    expect(getMoveArcOffsetPx('drift', 0.5, 24)).toBeCloseTo(-2);
    expect(getMoveArcOffsetPx('dart', 0.5, 24)).toBe(0);
    expect(getMoveArcOffsetPx('lurch', 0.5, 24)).toBe(0);
  });

  it('applies stomp landing dip only after 70 percent progress', () => {
    expect(getMoveArcOffsetPx('stomp', 0.69, 24)).toBe(0);
    expect(getMoveArcOffsetPx('stomp', 0.85, 24)).toBeCloseTo(2);
  });
});
