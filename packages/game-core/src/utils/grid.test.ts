import { describe, it, expect } from 'vitest';
import { manhattanDistance, chebyshevDistance, moveInDirection, positionsEqual, getNeighbors } from './grid.js';

describe('Grid utilities', () => {
  it('calculates Manhattan distance correctly', () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(manhattanDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });

  it('calculates Chebyshev distance correctly', () => {
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3);
  });

  it('moves in each direction correctly', () => {
    const pos = { x: 5, y: 5 };
    expect(moveInDirection(pos, 'N')).toEqual({ x: 5, y: 4 });
    expect(moveInDirection(pos, 'S')).toEqual({ x: 5, y: 6 });
    expect(moveInDirection(pos, 'W')).toEqual({ x: 4, y: 5 });
    expect(moveInDirection(pos, 'E')).toEqual({ x: 6, y: 5 });
    expect(moveInDirection(pos, 'NE')).toEqual({ x: 6, y: 4 });
    expect(moveInDirection(pos, 'NW')).toEqual({ x: 4, y: 4 });
    expect(moveInDirection(pos, 'SE')).toEqual({ x: 6, y: 6 });
    expect(moveInDirection(pos, 'SW')).toEqual({ x: 4, y: 6 });
  });

  it('checks positions equality correctly', () => {
    expect(positionsEqual({ x: 2, y: 3 }, { x: 2, y: 3 })).toBe(true);
    expect(positionsEqual({ x: 2, y: 3 }, { x: 2, y: 4 })).toBe(false);
  });

  it('returns all 8 neighboring positions', () => {
    const neighbors = getNeighbors({ x: 5, y: 5 });
    expect(neighbors).toHaveLength(8);
    expect(neighbors).toContainEqual({ x: 5, y: 4 });
    expect(neighbors).toContainEqual({ x: 6, y: 6 });
  });
});
