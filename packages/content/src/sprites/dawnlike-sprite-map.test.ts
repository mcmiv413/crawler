/**
 * Test layer: unit
 * Behavior: The DawnLike sprite map keeps atlas rectangles in bounds and provides distinct, resolvable coordinates for enemies, objects, and biome overrides.
 * Proof: Assertions check each rect stays within 2048x1024 at 16x16, enemy and object coordinate sets have no duplicates, floor and wall biome override sets meet distinct-count thresholds, and every DAWNLIKE_NAME_MAP key resolves with no missing sprites.
 * Validation: pnpm vitest run packages/content/src/sprites/dawnlike-sprite-map.test.ts
 */
import { describe, it, expect } from 'vitest';
import { DAWNLIKE_SPRITE_MAP } from './dawnlike-sprite-map.js';
import { DAWNLIKE_NAME_MAP, resolveSprite } from './dawnlike-name-map.js';
import { ENEMY_TEMPLATES, BIOME_DEFINITIONS, OBJECT_TEMPLATES } from '../index.js';

const ATLAS_WIDTH = 2048;
const ATLAS_HEIGHT = 1024;

describe('DawnLike Sprite Map', () => {
  it('all entries fit within atlas bounds', () => {
    for (const [key, rect] of Object.entries(DAWNLIKE_SPRITE_MAP)) {
      expect(rect.x + rect.w, `${key} x overflow`).toBeLessThanOrEqual(ATLAS_WIDTH);
      expect(rect.y + rect.h, `${key} y overflow`).toBeLessThanOrEqual(ATLAS_HEIGHT);
      expect(rect.w, `${key} width`).toBe(16);
      expect(rect.h, `${key} height`).toBe(16);
    }
  });

  it('all enemy sprites are unique', () => {
    const coords: string[] = [];
    for (const [enemyId] of ENEMY_TEMPLATES) {
      const r = DAWNLIKE_SPRITE_MAP[`enemy:${enemyId}`];
      if (r) coords.push(`${r.x},${r.y}`);
    }
    expect(new Set(coords).size).toBe(coords.length);
  });

  it('all object sprites are unique', () => {
    const coords: string[] = [];
    for (const [objectId] of OBJECT_TEMPLATES) {
      const r = DAWNLIKE_SPRITE_MAP[`object:${objectId}`];
      if (r) coords.push(`${r.x},${r.y}`);
    }
    expect(new Set(coords).size).toBe(coords.length);
  });

  it('biome floor overrides differ from one another', () => {
    const floors: string[] = [];
    for (const [biomeId] of BIOME_DEFINITIONS.entries()) {
      const r = DAWNLIKE_SPRITE_MAP[`tile:floor:${biomeId}`];
      if (r) floors.push(`${r.x},${r.y}`);
    }
    // At least 5 of 7 must be distinct (some sharing is acceptable)
    expect(new Set(floors).size).toBeGreaterThanOrEqual(5);
  });

  it('biome wall overrides differ from one another', () => {
    const walls: string[] = [];
    for (const [biomeId] of BIOME_DEFINITIONS.entries()) {
      const r = DAWNLIKE_SPRITE_MAP[`tile:wall:${biomeId}`];
      if (r) walls.push(`${r.x},${r.y}`);
    }
    expect(new Set(walls).size).toBeGreaterThanOrEqual(4);
  });

  it('all game keys resolve to a sprite in the atlas', () => {
    const missing: string[] = [];
    for (const key of Object.keys(DAWNLIKE_NAME_MAP)) {
      const sprite = resolveSprite(key);
      if (!sprite) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new Error(`${missing.length} game keys do not resolve to sprites:\n${missing.join('\n')}`);
    }
    expect(missing).toEqual([]);
  });
});
