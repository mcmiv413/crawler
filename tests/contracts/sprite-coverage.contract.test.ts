/**
 * Test layer: contract
 * Behavior: Sprite Coverage covers Sprite Coverage Contract; every biome has floor and wall tile sprite overrides; every enemy template has a sprite entry.
 * Proof: live catalog/schema assertions validate IDs, shapes, and cross references.
 * Validation: pnpm vitest run tests/contracts/sprite-coverage.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { ENEMY_TEMPLATES, BIOMES, OBJECT_TEMPLATES } from '@dungeon/content';
import { SPRITE_MAP } from '../../apps/web/src/sprites/sprite-map.js';

/**
 * Contract Tests: Sprite Coverage
 *
 * Validates that every content entity (enemy, biome, object) has a corresponding
 * sprite registered in SPRITE_MAP. Catches missing sprite entries when new
 * content is added.
 *
 * Moved from apps/web/src/sprites/sprite-map.test.ts.
 */
describe('Sprite Coverage Contract', () => {
  it('every biome has floor and wall tile sprite overrides', () => {
    for (const [biomeId] of BIOMES) {
      expect(Object.hasOwn(SPRITE_MAP, `tile:floor:${biomeId}`), `tile:floor:${biomeId}`).toBe(true);
      expect(Object.hasOwn(SPRITE_MAP, `tile:wall:${biomeId}`), `tile:wall:${biomeId}`).toBe(true);
    }
  });

  it('every enemy template has a sprite entry', () => {
    for (const [enemyId] of ENEMY_TEMPLATES) {
      expect(Object.hasOwn(SPRITE_MAP, `enemy:${enemyId}`), `enemy:${enemyId}`).toBe(true);
    }
  });

  it('every object template has a sprite entry', () => {
    for (const [objectId] of OBJECT_TEMPLATES) {
      expect(Object.hasOwn(SPRITE_MAP, `object:${objectId}`), `object:${objectId}`).toBe(true);
    }
  });

  it('all enemy sprite rects are unique (no two enemies share the same sprite)', () => {
    const enemyCoords: string[] = [];
    for (const [enemyId] of ENEMY_TEMPLATES) {
      const rect = SPRITE_MAP[`enemy:${enemyId}`];
      if (rect) enemyCoords.push(`${rect.x},${rect.y}`);
    }
    const unique = new Set(enemyCoords);
    expect(unique.size).toBe(enemyCoords.length);
  });

  it('all object sprite rects are unique', () => {
    const objectCoords: string[] = [];
    for (const [objectId] of OBJECT_TEMPLATES) {
      const rect = SPRITE_MAP[`object:${objectId}`];
      if (rect) objectCoords.push(`${rect.x},${rect.y}`);
    }
    const unique = new Set(objectCoords);
    expect(unique.size).toBe(objectCoords.length);
  });
});
