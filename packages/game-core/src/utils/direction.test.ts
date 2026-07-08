/**
 * Test layer: unit
 * Behavior: Direction covers positionToDirection; returns N when moving north (dy = -1); returns S when moving south (dy = 1).
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/utils/direction.test.ts
 */
import { describe, it, expect } from 'vitest';
import { positionToDirection } from './direction.js';

describe('positionToDirection', () => {
  it('returns N when moving north (dy = -1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 5, y: 4 })).toBe('N');
  });

  it('returns S when moving south (dy = 1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 5, y: 6 })).toBe('S');
  });

  it('returns E when moving east (dx = 1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 6, y: 5 })).toBe('E');
  });

  it('returns W when moving west (dx = -1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 4, y: 5 })).toBe('W');
  });

  it('returns NE when moving northeast (dx=1, dy=-1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 6, y: 4 })).toBe('NE');
  });

  it('returns NW when moving northwest (dx=-1, dy=-1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 4, y: 4 })).toBe('NW');
  });

  it('returns SE when moving southeast (dx=1, dy=1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 6, y: 6 })).toBe('SE');
  });

  it('returns SW when moving southwest (dx=-1, dy=1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 4, y: 6 })).toBe('SW');
  });

  it('returns null for no movement (same position)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });

  it('returns null for invalid movement (more than 1 cell away)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 7, y: 5 })).toBeNull();
    expect(positionToDirection({ x: 5, y: 5 }, { x: 5, y: 8 })).toBeNull();
  });
});
