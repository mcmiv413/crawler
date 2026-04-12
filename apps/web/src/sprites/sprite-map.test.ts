import { describe, it, expect } from 'vitest';
import { SPRITE_MAP, type SpriteRect } from './sprite-map.js';

describe('SPRITE_MAP', () => {
  it('has required keys', () => {
    expect(SPRITE_MAP['player']).toBeDefined();
    expect(SPRITE_MAP['tile:floor']).toBeDefined();
    expect(SPRITE_MAP['tile:wall']).toBeDefined();
    expect(SPRITE_MAP['tile:chest']).toBeDefined();
    expect(SPRITE_MAP['tile:stairs_down']).toBeDefined();
    expect(SPRITE_MAP['tile:stairs_up']).toBeDefined();
  });

  it('all rects have non-negative integer coordinates and 16×16 dimensions', () => {
    for (const [key, rect] of Object.entries(SPRITE_MAP)) {
      const r = rect as SpriteRect;
      expect(r.x, `${key}.x`).toBeGreaterThanOrEqual(0);
      expect(r.y, `${key}.y`).toBeGreaterThanOrEqual(0);
      expect(r.w, `${key}.w`).toBe(16);
      expect(r.h, `${key}.h`).toBe(16);
      expect(Number.isInteger(r.x), `${key}.x is integer`).toBe(true);
      expect(Number.isInteger(r.y), `${key}.y is integer`).toBe(true);
    }
  });

  it('all x/y are multiples of 16 (aligned to tile grid)', () => {
    for (const [key, rect] of Object.entries(SPRITE_MAP)) {
      const r = rect as SpriteRect;
      expect(r.x % 16, `${key}.x % 16`).toBe(0);
      expect(r.y % 16, `${key}.y % 16`).toBe(0);
    }
  });

  it('has at least one enemy entry', () => {
    const enemyKeys = Object.keys(SPRITE_MAP).filter(k => k.startsWith('enemy:'));
    expect(enemyKeys.length).toBeGreaterThan(0);
  });

  it('does not throw when accessing an unknown key', () => {
    expect(() => SPRITE_MAP['unknown:key']).not.toThrow();
    expect(SPRITE_MAP['unknown:key']).toBeUndefined();
  });
});
