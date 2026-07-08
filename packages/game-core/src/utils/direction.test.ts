/**
 * Test layer: unit
 * Behavior: positionToDirection maps adjacent cardinal and diagonal moves to direction codes and returns null for no or invalid movement.
 * Proof: Assertions check N, S, E, W, NE, NW, SE, and SW return values plus null for same-position and more-than-one-cell moves.
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
