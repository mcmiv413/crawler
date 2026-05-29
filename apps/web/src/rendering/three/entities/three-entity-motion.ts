/**
 * Entity motion computation for the Three.js overlay.
 *
 * Provides pure coordinate functions for converting entity move and bump
 * animation state into screen-space pixel positions for use by the overlay.
 *
 * No Three.js imports — these are pure math functions that work in any
 * test environment without a WebGL context.
 *
 * Y-axis convention
 * -----------------
 * These functions return game-space screen coordinates (y+ = down).
 * The ThreeAnimationOverlay applies the single y-flip point (canvasHeight - y)
 * before passing to Three mesh positions.
 *
 * Ownership / canvas suppression
 * --------------------------------
 * shouldCanvasSuppressEntity(entityId, ownedEntityIds) returns true when
 * the Three overlay owns that entity's animation — canvas should skip drawing it.
 */

import type { EntityId } from '@dungeon/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoveInput {
  readonly fromPos: { readonly x: number; readonly y: number };
  readonly toPos: { readonly x: number; readonly y: number };
  readonly progress: number;
  /** Pixel offset from a prior chained move still in progress at t=0. */
  readonly fromOffsetPx?: { readonly x: number; readonly y: number };
}

export interface BumpInput {
  readonly attackerPos: { readonly x: number; readonly y: number };
  readonly defenderPos: { readonly x: number; readonly y: number };
  readonly progress: number;
  /** Fraction of progress [0,1] at which the attacker reaches maximum lunge distance. */
  readonly impactFraction?: number;
}

export interface ScreenPos {
  readonly x: number;
  readonly y: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum lunge distance as a fraction of one tile. */
const BUMP_LUNGE_FRACTION = 0.35;

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/**
 * Convert a tile coordinate to screen-space pixel position at tile center.
 */
function tileCenterPx(
  tileX: number,
  tileY: number,
  tileSize: number,
  vpLeft: number,
  vpTop: number,
  cameraOffset: { readonly x: number; readonly y: number },
): ScreenPos {
  return {
    x: (tileX - vpLeft) * tileSize + tileSize / 2 + cameraOffset.x,
    y: (tileY - vpTop) * tileSize + tileSize / 2 + cameraOffset.y,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute screen-space pixel position for a moving entity.
 *
 * Interpolates linearly from fromPos to toPos based on progress.
 * fromOffsetPx (for chain-move continuity) is blended from its full value
 * at progress=0 to zero at progress=1.
 */
export function computeMoveScreenPosition(
  move: MoveInput,
  tileSize: number,
  vpLeft: number,
  vpTop: number,
  cameraOffset: { readonly x: number; readonly y: number },
): ScreenPos {
  const fromCenter = tileCenterPx(
    move.fromPos.x,
    move.fromPos.y,
    tileSize,
    vpLeft,
    vpTop,
    cameraOffset,
  );
  const toCenter = tileCenterPx(
    move.toPos.x,
    move.toPos.y,
    tileSize,
    vpLeft,
    vpTop,
    cameraOffset,
  );

  const p = move.progress;
  const baseX = fromCenter.x + (toCenter.x - fromCenter.x) * p;
  const baseY = fromCenter.y + (toCenter.y - fromCenter.y) * p;

  // fromOffsetPx diminishes from full at p=0 to zero at p=1
  const fromOffset = move.fromOffsetPx ?? { x: 0, y: 0 };
  const offsetX = fromOffset.x * (1 - p);
  const offsetY = fromOffset.y * (1 - p);

  return { x: baseX + offsetX, y: baseY + offsetY };
}

/**
 * Compute screen-space pixel position for an attacking entity during a bump/lunge.
 *
 * The attacker lunges toward the defender up to impactFraction, then recoils
 * back to the starting position by progress=1.
 */
export function computeBumpScreenPosition(
  bump: BumpInput,
  tileSize: number,
  vpLeft: number,
  vpTop: number,
  cameraOffset: { readonly x: number; readonly y: number },
): ScreenPos {
  const baseCenter = tileCenterPx(
    bump.attackerPos.x,
    bump.attackerPos.y,
    tileSize,
    vpLeft,
    vpTop,
    cameraOffset,
  );

  // Direction vector from attacker to defender (tile space)
  const dx = bump.defenderPos.x - bump.attackerPos.x;
  const dy = bump.defenderPos.y - bump.attackerPos.y;

  // Maximum lunge displacement in pixels
  const maxLungeX = dx * tileSize * BUMP_LUNGE_FRACTION;
  const maxLungeY = dy * tileSize * BUMP_LUNGE_FRACTION;

  const impactFrac = bump.impactFraction ?? 0.5;
  const p = bump.progress;

  // Lunge phase: progress 0→impactFrac, lunge 0→max
  // Recoil phase: progress impactFrac→1, lunge max→0
  let lungeT: number;
  if (p <= impactFrac) {
    lungeT = impactFrac > 0 ? p / impactFrac : 0;
  } else {
    lungeT = impactFrac < 1 ? 1 - (p - impactFrac) / (1 - impactFrac) : 0;
  }

  return {
    x: baseCenter.x + maxLungeX * lungeT,
    y: baseCenter.y + maxLungeY * lungeT,
  };
}

/**
 * Returns true when the canvas renderer should skip drawing this entity
 * because Three.js owns its animation.
 */
export function shouldCanvasSuppressEntity(
  entityId: EntityId,
  ownedEntityIds: readonly EntityId[],
): boolean {
  return ownedEntityIds.includes(entityId);
}
