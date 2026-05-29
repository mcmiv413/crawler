/**
 * Workstream 6: Entity motion in Three.js overlay.
 *
 * three-entity-motion.ts — logic for computing entity positions during
 * move and bump/lunge animations as screen-space pixel coordinates.
 *
 * Key contracts:
 *  - At progress 0, entity is at the fromPos tile center
 *  - At progress 1, entity is at the toPos tile center
 *  - Intermediate progress interpolates linearly between from and to
 *  - Bump/lunge: at impact fraction entity is offset toward defender, then recoils
 *  - Overlapping moves (chain): fromOffsetPx is applied at progress 0
 *  - Edge clamping: positions within valid tile bounds are returned unchanged
 *  - Canvas suppression: entities with an active Three-owned entityId are suppressed
 */

import { describe, it, expect } from 'vitest';
import type { EntityId } from '@dungeon/contracts';
import {
  computeMoveScreenPosition,
  computeBumpScreenPosition,
  shouldCanvasSuppressEntity,
} from './three-entity-motion.js';

// ---------------------------------------------------------------------------
// Constants — no config imports
// ---------------------------------------------------------------------------

const TILE = 24;
const CANVAS_W = 480;
const CANVAS_H = 360;
const VP_LEFT = 0;
const VP_TOP = 0;
const CAM_OFFSET = { x: 0, y: 0 };

type Pos = { x: number; y: number };

function makeMove(
  fromPos: Pos,
  toPos: Pos,
  progress: number,
  fromOffsetPx: Pos = { x: 0, y: 0 },
) {
  return { fromPos, toPos, progress, fromOffsetPx };
}

function makeBump(attackerPos: Pos, defenderPos: Pos, progress: number, impactFraction = 0.5) {
  return { attackerPos, defenderPos, progress, impactFraction };
}

// ---------------------------------------------------------------------------
// Suite: computeMoveScreenPosition
// ---------------------------------------------------------------------------

describe('computeMoveScreenPosition', () => {
  it('at progress 0 returns tile center of fromPos', () => {
    const move = makeMove({ x: 2, y: 3 }, { x: 3, y: 3 }, 0);
    const pos = computeMoveScreenPosition(move, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);

    // tile center of fromPos (2, 3) with VP at (0, 0)
    const expectedX = 2 * TILE + TILE / 2;
    const expectedY = 3 * TILE + TILE / 2;
    expect(pos.x).toBeCloseTo(expectedX);
    expect(pos.y).toBeCloseTo(expectedY);
  });

  it('at progress 1 returns tile center of toPos', () => {
    const move = makeMove({ x: 2, y: 3 }, { x: 3, y: 3 }, 1);
    const pos = computeMoveScreenPosition(move, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);

    const expectedX = 3 * TILE + TILE / 2;
    const expectedY = 3 * TILE + TILE / 2;
    expect(pos.x).toBeCloseTo(expectedX);
    expect(pos.y).toBeCloseTo(expectedY);
  });

  it('at progress 0.5 is halfway between from and to', () => {
    const move = makeMove({ x: 0, y: 0 }, { x: 4, y: 0 }, 0.5);
    const pos = computeMoveScreenPosition(move, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);

    // from center: (0*24 + 12 = 12), to center: (4*24 + 12 = 108), halfway = 60
    const fromX = 0 * TILE + TILE / 2;
    const toX = 4 * TILE + TILE / 2;
    const expectedX = fromX + (toX - fromX) * 0.5;
    expect(pos.x).toBeCloseTo(expectedX);
  });

  it('applies viewport offset to screen position', () => {
    // If viewport starts at tile (2, 1), the visual offset shifts positions left/up
    const vpLeft = 2;
    const vpTop = 1;
    const move = makeMove({ x: 2, y: 1 }, { x: 3, y: 1 }, 0);
    const pos = computeMoveScreenPosition(move, TILE, vpLeft, vpTop, CAM_OFFSET);

    // tile (2,1) relative to vp (2,1) → screen (0,0) → center = (12, 12)
    expect(pos.x).toBeCloseTo(TILE / 2);
    expect(pos.y).toBeCloseTo(TILE / 2);
  });

  it('applies camera offset', () => {
    const camOffset = { x: 8, y: -4 };
    const move = makeMove({ x: 0, y: 0 }, { x: 0, y: 0 }, 0);
    const withoutCam = computeMoveScreenPosition(move, TILE, VP_LEFT, VP_TOP, { x: 0, y: 0 });
    const withCam = computeMoveScreenPosition(move, TILE, VP_LEFT, VP_TOP, camOffset);

    expect(withCam.x).toBeCloseTo(withoutCam.x + camOffset.x);
    expect(withCam.y).toBeCloseTo(withoutCam.y + camOffset.y);
  });

  it('applies fromOffsetPx at progress 0 (chain move continuation)', () => {
    // An entity was mid-move, now a new move starts from the current rendered position.
    // fromOffsetPx = { x: 12, y: 0 } means we were 12px into the previous move
    const fromOffsetPx = { x: 12, y: 0 };
    const move = makeMove({ x: 2, y: 3 }, { x: 3, y: 3 }, 0, fromOffsetPx);
    const pos = computeMoveScreenPosition(move, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);

    const baseCenterX = 2 * TILE + TILE / 2;
    const baseCenterY = 3 * TILE + TILE / 2;
    expect(pos.x).toBeCloseTo(baseCenterX + fromOffsetPx.x);
    expect(pos.y).toBeCloseTo(baseCenterY + fromOffsetPx.y);
  });

  it('fromOffsetPx linearly diminishes to 0 at progress 1', () => {
    const fromOffsetPx = { x: 24, y: 0 };
    const move = makeMove({ x: 2, y: 3 }, { x: 3, y: 3 }, 1, fromOffsetPx);
    const pos = computeMoveScreenPosition(move, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);

    // At progress 1, should be exactly at toPos center with no offset
    const toCenterX = 3 * TILE + TILE / 2;
    const toCenterY = 3 * TILE + TILE / 2;
    expect(pos.x).toBeCloseTo(toCenterX);
    expect(pos.y).toBeCloseTo(toCenterY);
  });

  it('handles diagonal movement', () => {
    const move = makeMove({ x: 0, y: 0 }, { x: 2, y: 2 }, 1);
    const pos = computeMoveScreenPosition(move, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);
    expect(pos.x).toBeCloseTo(2 * TILE + TILE / 2);
    expect(pos.y).toBeCloseTo(2 * TILE + TILE / 2);
  });

  it('handles large tile positions without overflow', () => {
    const move = makeMove({ x: 50, y: 50 }, { x: 51, y: 50 }, 0.5);
    const pos = computeMoveScreenPosition(move, TILE, 0, 0, CAM_OFFSET);
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite: computeBumpScreenPosition
// ---------------------------------------------------------------------------

describe('computeBumpScreenPosition', () => {
  const attackerPos = { x: 2, y: 3 };
  const defenderPos = { x: 3, y: 3 }; // one tile to the right

  it('at progress 0 returns attacker tile center', () => {
    const bump = makeBump(attackerPos, defenderPos, 0);
    const pos = computeBumpScreenPosition(bump, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);
    expect(pos.x).toBeCloseTo(attackerPos.x * TILE + TILE / 2);
    expect(pos.y).toBeCloseTo(attackerPos.y * TILE + TILE / 2);
  });

  it('at impact fraction (0.5), entity is displaced toward defender', () => {
    const bump = makeBump(attackerPos, defenderPos, 0.5);
    const base = computeBumpScreenPosition(
      makeBump(attackerPos, defenderPos, 0),
      TILE, VP_LEFT, VP_TOP, CAM_OFFSET
    );
    const atImpact = computeBumpScreenPosition(bump, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);

    // Attacker should have moved toward defender (x+ direction)
    expect(atImpact.x).toBeGreaterThan(base.x);
  });

  it('at progress 1 returns back to attacker tile center (recoil complete)', () => {
    const bump = makeBump(attackerPos, defenderPos, 1);
    const pos = computeBumpScreenPosition(bump, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);
    expect(pos.x).toBeCloseTo(attackerPos.x * TILE + TILE / 2);
    expect(pos.y).toBeCloseTo(attackerPos.y * TILE + TILE / 2);
  });

  it('bump upward: attacker above defender', () => {
    const attackerUp = { x: 3, y: 2 };
    const defenderDown = { x: 3, y: 3 };
    const bump = makeBump(attackerUp, defenderDown, 0.5);
    const base = computeBumpScreenPosition(
      makeBump(attackerUp, defenderDown, 0),
      TILE, VP_LEFT, VP_TOP, CAM_OFFSET,
    );
    const atImpact = computeBumpScreenPosition(bump, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);
    // Attacker should have moved down toward defender
    expect(atImpact.y).toBeGreaterThan(base.y);
  });

  it('returns finite coordinates for all progress values', () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const bump = makeBump(attackerPos, defenderPos, p);
      const pos = computeBumpScreenPosition(bump, TILE, VP_LEFT, VP_TOP, CAM_OFFSET);
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: shouldCanvasSuppressEntity
// ---------------------------------------------------------------------------

describe('shouldCanvasSuppressEntity', () => {
  it('returns false when Three owns no entities', () => {
    expect(shouldCanvasSuppressEntity('player' as EntityId, [])).toBe(false);
  });

  it('returns true when entity is in the Three-owned list', () => {
    expect(shouldCanvasSuppressEntity('player' as EntityId, ['player', 'enemy-1'] as any)).toBe(true);
  });

  it('returns false when entity is NOT in the Three-owned list', () => {
    expect(shouldCanvasSuppressEntity('enemy-2' as EntityId, ['player', 'enemy-1'] as any)).toBe(false);
  });

  it('returns false for empty entity ID string', () => {
    expect(shouldCanvasSuppressEntity('' as any, ['player'] as any)).toBe(false);
  });

  it('handles large owned entity lists efficiently', () => {
    const owned = Array.from({ length: 1000 }, (_, i) => `entity-${i}`) as any[];
    expect(shouldCanvasSuppressEntity('entity-500' as any, owned)).toBe(true);
    expect(shouldCanvasSuppressEntity('entity-999' as any, owned)).toBe(true);
    expect(shouldCanvasSuppressEntity('entity-9999' as any, owned)).toBe(false);
  });
});
