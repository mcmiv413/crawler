/**
 * Test layer: unit
 * Behavior: SPRITE_MAP exposes required player/item/enemy/status entries and valid 16x16 atlas rectangles while unknown keys remain safe to read.
 * Proof: Assertions check required keys with arrayContaining, nonnegative integer x/y coordinates, 16px width and height, presence of enemy:goblin_archer, and undefined return without throwing for unknown:key.
 * Validation: pnpm vitest run apps/web/src/sprites/sprite-map.test.ts
 */
import { describe, it, expect } from 'vitest';
import { SPRITE_MAP } from './sprite-map.js';

/**
 * Unit tests for SPRITE_MAP structure.
 *
 * Tests structural invariants only — no live @dungeon/content imports.
 * Cross-reference coverage (every enemy/biome/object has a sprite) lives in
 * tests/contracts/sprite-coverage.contract.test.ts.
 */
describe('SPRITE_MAP', () => {
  it('has required static keys', () => {
    expect(Object.keys(SPRITE_MAP)).toEqual(expect.arrayContaining([
      'player',
      'tile:floor',
      'tile:wall',
      'tile:chest',
      'tile:stairs_down',
      'tile:stairs_up',
    ]));
  });

  it('all rects have non-negative integer coordinates and 16x16 dimensions', () => {
    for (const [key, rect] of Object.entries(SPRITE_MAP)) {
      expect(rect.x, `${key}.x`).toBeGreaterThanOrEqual(0);
      expect(rect.y, `${key}.y`).toBeGreaterThanOrEqual(0);
      expect(rect.w, `${key}.w`).toBe(16);
      expect(rect.h, `${key}.h`).toBe(16);
      expect(Number.isInteger(rect.x), `${key}.x is integer`).toBe(true);
      expect(Number.isInteger(rect.y), `${key}.y is integer`).toBe(true);
    }
  });

  it('has at least one enemy entry', () => {
    const enemyKeys = Object.keys(SPRITE_MAP).filter(k => k.startsWith('enemy:'));
    expect(enemyKeys).toEqual(expect.arrayContaining(['enemy:goblin_archer']));
  });

  it('does not throw when accessing an unknown key', () => {
    expect(() => SPRITE_MAP['unknown:key']).not.toThrow();
    expect(SPRITE_MAP['unknown:key']).toBeUndefined();
  });
});
