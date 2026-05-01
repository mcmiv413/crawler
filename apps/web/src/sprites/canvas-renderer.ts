import type { MapView, MapCellView, EntityView } from '@dungeon/presenter';
import type { MoveAnimStyle } from '@dungeon/presenter';
import { CELL_SIZE } from '../config/ui-config.js';
import { spriteRegistry } from './sprite-registry.js';

// ── Animation state interfaces ────────────────────────────────────
// Defined locally so the renderer has no dependency on React hooks.

interface BumpAnimationState {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerPos: { x: number; y: number };
  defenderPos: { x: number; y: number };
  progress: number;
}

interface MoveAnimationState {
  id: string;
  entityId: string;
  fromPos: { x: number; y: number };
  toPos:   { x: number; y: number };
  style: MoveAnimStyle;
  progress: number;
}

// ── Easing functions (progress 0 → 1) ────────────────────────────

/**
 * Returns the eased position fraction (0 = at origin, 1 = at destination).
 */
function applyMoveEasing(style: MoveAnimStyle, p: number): number {
  switch (style) {
    case 'step':
      // Snappy ease-out cubic — feels responsive
      return 1 - Math.pow(1 - p, 3);

    case 'slide':
      // Ease-out quadratic — smooth neutral glide
      return 1 - (1 - p) * (1 - p);

    case 'dart':
      // Ease-in cubic — explosive start, snaps to destination
      return p * p * p;

    case 'drift':
      // Ease-in-out quintic — slow, deliberate repositioning
      return p < 0.5
        ? 16 * p * p * p * p * p
        : 1 - Math.pow(-2 * p + 2, 5) / 2;

    case 'stomp': {
      // Back ease-out — overshoot then settle (feels heavy)
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    }

    case 'lurch':
      // Freeze for first 25%, then rush (delayed, sudden)
      if (p < 0.25) return 0;
      return Math.pow((p - 0.25) / 0.75, 2);

    default:
      return p;
  }
}

/**
 * Returns a Y screen-space arc offset in pixels.
 * Negative = up (sprite hops slightly upward at mid-step).
 * Zero for styles that shouldn't hop (dart, lurch).
 * Stomp gets a downward dip at landing instead of an upward hop.
 */
function applyArcOffset(style: MoveAnimStyle, p: number): number {
  switch (style) {
    case 'step':
      return -Math.sin(p * Math.PI) * 4;  // gentle 4px hop

    case 'slide':
      return -Math.sin(p * Math.PI) * 3;  // subtle 3px hop

    case 'drift':
      return -Math.sin(p * Math.PI) * 2;  // barely perceptible float

    case 'stomp':
      // No hop — small downward press at landing (last 30% of anim)
      return p > 0.7 ? Math.sin(((p - 0.7) / 0.3) * Math.PI) * 2 : 0;

    case 'dart':
    case 'lurch':
      return 0;  // no arc — these are ground-level movement styles

    default:
      return 0;
  }
}

// ── Tile & entity drawing ─────────────────────────────────────────

/** Draw a single tile sprite or ASCII fallback onto the canvas. */
function drawCell(
  ctx: CanvasRenderingContext2D,
  cell: MapCellView,
  screenX: number,
  screenY: number,
): void {
  const isRemembered = cell.visibility === 'remembered';

  if (isRemembered) {
    ctx.globalAlpha = 0.35;
  }

  let sprite = null;
  if (cell.spriteName) {
    sprite = spriteRegistry.getSpriteByAtlasName(cell.spriteName);
  }

  if (sprite) {
    const { image, rect } = sprite;
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, screenX, screenY, CELL_SIZE, CELL_SIZE);
  } else {
    ctx.fillStyle = cell.bgColor;
    ctx.fillRect(screenX, screenY, CELL_SIZE, CELL_SIZE);
    ctx.fillStyle = cell.color;
    ctx.font = `${CELL_SIZE - 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cell.ascii, screenX + CELL_SIZE / 2, screenY + CELL_SIZE / 2);
  }

  if (isRemembered) {
    ctx.globalAlpha = 1.0;
  }
}

/** Draw an entity sprite or ASCII fallback, with optional pixel offset. */
function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: EntityView,
  screenX: number,
  screenY: number,
  offsetX: number = 0,
  offsetY: number = 0,
): void {
  const finalX = screenX + offsetX;
  const finalY = screenY + offsetY;

  let sprite = null;
  if ('spriteName' in entity && entity.spriteName) {
    sprite = spriteRegistry.getSpriteByAtlasName(entity.spriteName);
  } else if (entity.type === 'player') {
    sprite = spriteRegistry.getSprite('player');
  }

  if (sprite) {
    const { image, rect } = sprite;
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, finalX, finalY, CELL_SIZE, CELL_SIZE);
  } else {
    ctx.fillStyle = entity.color;
    ctx.font = `${CELL_SIZE - 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.ascii, finalX + CELL_SIZE / 2, finalY + CELL_SIZE / 2);
  }
}

// ── Main render function ──────────────────────────────────────────

/** Render the dungeon map onto the given canvas context. */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  map: MapView,
  vpLeft: number,
  vpTop: number,
  vpWidth: number,
  vpHeight: number,
  bumpAnimations: BumpAnimationState[] = [],
  moveAnimations: MoveAnimationState[] = [],
): void {
  ctx.clearRect(0, 0, vpWidth * CELL_SIZE, vpHeight * CELL_SIZE);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, vpWidth * CELL_SIZE, vpHeight * CELL_SIZE);

  // Build fast lookup maps
  const cellLookup = new Map<string, MapCellView>();
  for (const cell of map.cells) {
    cellLookup.set(`${cell.x},${cell.y}`, cell);
  }

  const entityLookup = new Map<string, EntityView>();
  for (const entity of map.entities) {
    entityLookup.set(`${entity.x},${entity.y}`, entity);
  }

  // Build animation lookups by entity id
  const bumpLookup = new Map<string, BumpAnimationState>();
  for (const anim of bumpAnimations) {
    bumpLookup.set(anim.attackerId, anim);
  }

  const moveLookup = new Map<string, MoveAnimationState>();
  for (const anim of moveAnimations) {
    moveLookup.set(anim.entityId, anim);
  }

  // Draw cells, then entities on top
  for (let gy = vpTop; gy < vpTop + vpHeight; gy++) {
    for (let gx = vpLeft; gx < vpLeft + vpWidth; gx++) {
      const screenX = (gx - vpLeft) * CELL_SIZE;
      const screenY = (gy - vpTop)  * CELL_SIZE;
      const key = `${gx},${gy}`;
      const cell = cellLookup.get(key);
      if (!cell) continue;

      drawCell(ctx, cell, screenX, screenY);

      if (cell.visibility !== 'visible') continue;

      const entity = entityLookup.get(key);
      if (!entity) continue;

      let offsetX = 0;
      let offsetY = 0;

      // ── Move offset ─────────────────────────────────────────────
      // Entity is already at toPos in game state. We render it offset
      // backward toward fromPos and decay that offset to zero.
      const move = moveLookup.get(entity.id);
      if (move) {
        const t = applyMoveEasing(move.style, move.progress);
        // t goes 0→1; at t=0 fully at fromPos, at t=1 fully at toPos
        offsetX += (move.fromPos.x - move.toPos.x) * CELL_SIZE * (1 - t);
        offsetY += (move.fromPos.y - move.toPos.y) * CELL_SIZE * (1 - t);
        // Arc: screen-space vertical hop independent of tile direction
        offsetY += applyArcOffset(move.style, move.progress);
      }

      // ── Bump offset ─────────────────────────────────────────────
      // Stacks on top of any move offset — brief overlap is fine.
      const bump = bumpLookup.get(entity.id);
      if (bump) {
        const distance = 0.5;
        const easeProgress = bump.progress < 0.5
          ? bump.progress * 2
          : 2 - bump.progress * 2;
        offsetX += (bump.defenderPos.x - bump.attackerPos.x) * CELL_SIZE * distance * easeProgress;
        offsetY += (bump.defenderPos.y - bump.attackerPos.y) * CELL_SIZE * distance * easeProgress;
      }

      drawEntity(ctx, entity, screenX, screenY, offsetX, offsetY);

      // Instance color square for disambiguation when 2+ of same type visible
      if (entity.instanceColor) {
        // Dark backdrop: 5×6px at (CELL_SIZE - 5, 0)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.70)';
        ctx.fillRect(screenX + CELL_SIZE - 5, screenY, 5, 6);
        // Colored square: 3×4px at (CELL_SIZE - 4, 1)
        ctx.fillStyle = entity.instanceColor;
        ctx.fillRect(screenX + CELL_SIZE - 4, screenY + 1, 3, 4);
      }
    }
  }
}
