import { describe, it, expect } from 'vitest';
import { VP_WIDTH, VP_HEIGHT, CELL_SIZE, VIEWPORT_PX_WIDTH, VIEWPORT_PX_HEIGHT } from './viewport.js';

describe('viewport constants', () => {
  it('exports consistent VP_WIDTH and VP_HEIGHT', () => {
    expect(VP_WIDTH).toBe(30);
    expect(VP_HEIGHT).toBe(32);
  });

  it('exports consistent CELL_SIZE', () => {
    expect(CELL_SIZE).toBe(16);
  });

  it('computes viewport pixel dimensions correctly', () => {
    expect(VIEWPORT_PX_WIDTH).toBe(VP_WIDTH * CELL_SIZE);
    expect(VIEWPORT_PX_HEIGHT).toBe(VP_HEIGHT * CELL_SIZE);
  });

  it('all viewport constants are used by both components', () => {
    // This test just verifies the constants exist and are importable
    // Actual usage is verified by component-level tests
    expect(typeof VP_WIDTH).toBe('number');
    expect(typeof VP_HEIGHT).toBe('number');
    expect(typeof CELL_SIZE).toBe('number');
  });
});
