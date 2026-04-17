import { describe, it, expect } from 'vitest';
import { SPRITE_MAP } from './sprite-map.js';
import { ENEMY_TEMPLATES, BIOMES, OBJECT_TEMPLATES } from '@dungeon/content';

describe('SPRITE_MAP', () => {
  it('has required keys', () => {
    expect(SPRITE_MAP['player']).toBeDefined();
    expect(SPRITE_MAP['tile:floor']).toBeDefined();
    expect(SPRITE_MAP['tile:wall']).toBeDefined();
    expect(SPRITE_MAP['tile:chest']).toBeDefined();
    expect(SPRITE_MAP['tile:stairs_down']).toBeDefined();
    expect(SPRITE_MAP['tile:stairs_up']).toBeDefined();

    // Biome tile overrides from actual BIOMES data
    for (const [biomeId] of BIOMES) {
      expect(SPRITE_MAP[`tile:floor:${biomeId}`], `tile:floor:${biomeId}`).toBeDefined();
      expect(SPRITE_MAP[`tile:wall:${biomeId}`], `tile:wall:${biomeId}`).toBeDefined();
    }

    // Enemies from actual ENEMY_TEMPLATES data
    for (const [enemyId] of ENEMY_TEMPLATES) {
      expect(SPRITE_MAP[`enemy:${enemyId}`], `enemy:${enemyId}`).toBeDefined();
    }

    // Objects from actual OBJECT_TEMPLATES data
    for (const [objectId] of OBJECT_TEMPLATES) {
      expect(SPRITE_MAP[`object:${objectId}`], `object:${objectId}`).toBeDefined();
    }
  });

  it('all rects have non-negative integer coordinates and 16×16 dimensions', () => {
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
    expect(enemyKeys.length).toBeGreaterThan(0);
  });

  it('all enemy: sprite rects are unique (no two enemies share the same sprite)', () => {
    const enemyCoords: string[] = [];
    for (const [enemyId] of ENEMY_TEMPLATES) {
      const rect = SPRITE_MAP[`enemy:${enemyId}`];
      if (rect) enemyCoords.push(`${rect.x},${rect.y}`);
    }
    const unique = new Set(enemyCoords);
    expect(unique.size).toBe(enemyCoords.length);
  });

  it('all object: sprite rects are unique', () => {
    const objectCoords: string[] = [];
    for (const [objectId] of OBJECT_TEMPLATES) {
      const rect = SPRITE_MAP[`object:${objectId}`];
      if (rect) objectCoords.push(`${rect.x},${rect.y}`);
    }
    const unique = new Set(objectCoords);
    expect(unique.size).toBe(objectCoords.length);
  });

  it('does not throw when accessing an unknown key', () => {
    expect(() => SPRITE_MAP['unknown:key']).not.toThrow();
    expect(SPRITE_MAP['unknown:key']).toBeUndefined();
  });
});
