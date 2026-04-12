import { describe, it, expect } from 'vitest';
import { positionToDirection } from './direction.js';

describe('positionToDirection', () => {
  it('maps N correctly (0, -1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 5, y: 4 })).toBe('N');
  });

  it('maps S correctly (0, +1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 5, y: 6 })).toBe('S');
  });

  it('maps E correctly (+1, 0)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 6, y: 5 })).toBe('E');
  });

  it('maps W correctly (-1, 0)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 4, y: 5 })).toBe('W');
  });

  it('maps NE correctly (+1, -1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 6, y: 4 })).toBe('NE');
  });

  it('maps NW correctly (-1, -1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 4, y: 4 })).toBe('NW');
  });

  it('maps SE correctly (+1, +1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 6, y: 6 })).toBe('SE');
  });

  it('maps SW correctly (-1, +1)', () => {
    expect(positionToDirection({ x: 5, y: 5 }, { x: 4, y: 6 })).toBe('SW');
  });

  it('returns null for non-adjacent positions', () => {
    expect(positionToDirection({ x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
    expect(positionToDirection({ x: 0, y: 0 }, { x: 0, y: 3 })).toBeNull();
  });
});
