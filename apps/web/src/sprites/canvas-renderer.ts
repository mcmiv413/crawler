import type { MapView, MapCellView, EntityView } from '@dungeon/presenter';
import type { MoveAnimStyle, StatusPresentationView, ConsumableAnimationPresentationView } from '@dungeon/presenter';
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

interface ConsumableAnimationState {
  id: string;
  effect: 'heal' | 'buff' | 'cure' | 'damage';
  playerPos: { x: number; y: number };
  blastPositions: readonly { x: number; y: number }[];
  startTime: number;
  progress: number;
  durationMs: number;
  presentation: ConsumableAnimationPresentationView;
}

/** Player-level effects driven by active status conditions (not time-limited animations). */
interface PlayerEffects {
  readonly statusPresentations?: readonly StatusPresentationView[];
}

interface ResolvedPlayerEffects {
  readonly entityScale: number;
  readonly ring?: NonNullable<StatusPresentationView['ring']>;
}

function resolvePlayerEffects(playerEffects: PlayerEffects): ResolvedPlayerEffects {
  const presentations = playerEffects.statusPresentations ?? [];
  let entityScale = 1;
  let ring: NonNullable<StatusPresentationView['ring']> | undefined;

  for (const presentation of presentations) {
    if (presentation.entityScale !== undefined) {
      entityScale = Math.max(entityScale, presentation.entityScale);
    }
    ring ??= presentation.ring;
  }

  return ring === undefined ? { entityScale } : { entityScale, ring };
}

// ── Easing functions (progress 0 → 1) ────────────────────────────

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

/**
 * Draw an entity sprite with optional pixel offset and scale.
 * scale > 1 grows the sprite centered on the cell.
 */
function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: EntityView,
  screenX: number,
  screenY: number,
  offsetX: number = 0,
  offsetY: number = 0,
  scale: number = 1.0,
): void {
  const scaledSize  = CELL_SIZE * scale;
  const scaleOffset = (CELL_SIZE - scaledSize) / 2;
  const finalX = screenX + offsetX + scaleOffset;
  const finalY = screenY + offsetY + scaleOffset;

  let sprite = null;
  if ('spriteName' in entity && entity.spriteName) {
    sprite = spriteRegistry.getSpriteByAtlasName(entity.spriteName);
  } else if (entity.type === 'player') {
    sprite = spriteRegistry.getSprite('player');
  }

  if (sprite) {
    const { image, rect } = sprite;
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, finalX, finalY, scaledSize, scaledSize);
  } else {
    ctx.fillStyle = entity.color;
    ctx.font = `${scaledSize - 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.ascii, finalX + scaledSize / 2, finalY + scaledSize / 2);
  }
}

// ── Consumable effect drawing ─────────────────────────────────────
//HUMANNNOTE: these animations feel like they should either be there own standalong definitions per file per function or be defined with the object itself. At the very least the consumable objects should import the animation to be used and the animation to be used should be imported from the consumable at the time the user consumes the item.
/**
 * Heal — three red heart sprites float upward from the player tile,
 * staggered 15% apart, each rising ~1.8 cells and fading to transparent.
 */
function drawHealEffect(
  ctx: CanvasRenderingContext2D,
  anim: ConsumableAnimationState,
  vpLeft: number,
  vpTop: number,
): void {
  const sx = (anim.playerPos.x - vpLeft) * CELL_SIZE;
  const sy = (anim.playerPos.y - vpTop)  * CELL_SIZE;
  const HEART_SIZE = Math.round(CELL_SIZE * 0.7);
  const heartSprite = spriteRegistry.getSpriteByAtlasName('red heart full');

  for (let i = 0; i < 3; i++) {
    const delay  = i * 0.15;
    const hp     = Math.max(0, (anim.progress - delay) / (1 - delay));
    if (hp <= 0) continue;

    const alpha  = 1 - hp;
    const riseY  = hp * CELL_SIZE * 1.8;
    const xOff   = (i - 1) * CELL_SIZE * 0.45;

    ctx.globalAlpha = alpha;
    if (heartSprite) {
      ctx.drawImage(
        heartSprite.image,
        heartSprite.rect.x, heartSprite.rect.y,
        heartSprite.rect.w, heartSprite.rect.h,
        sx + xOff + (CELL_SIZE - HEART_SIZE) / 2,
        sy - riseY + (CELL_SIZE - HEART_SIZE) / 2,
        HEART_SIZE, HEART_SIZE,
      );
    } else {
      // Fallback: simple red cross
      ctx.fillStyle = '#ff4455';
      ctx.fillRect(sx + xOff + 8, sy - riseY + 4,  4, 10);
      ctx.fillRect(sx + xOff + 4, sy - riseY + 8,  12, 4);
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Buff — two concentric gold rings burst outward from the player tile and fade.
 */
function drawBuffEffect(
  ctx: CanvasRenderingContext2D,
  anim: ConsumableAnimationState,
  vpLeft: number,
  vpTop: number,
): void {
  const sx = (anim.playerPos.x - vpLeft) * CELL_SIZE;
  const sy = (anim.playerPos.y - vpTop)  * CELL_SIZE;
  const p  = anim.progress;

  // Outer ring — expands to 1.5× cell width
  const outerExpand = Math.min(1, p * 1.8) * CELL_SIZE * 0.75;
  const outerAlpha  = Math.max(0, 1 - p);
  ctx.globalAlpha   = outerAlpha;
  ctx.strokeStyle   = '#ffd700';
  ctx.lineWidth     = 2;
  ctx.strokeRect(
    sx - outerExpand / 2,
    sy - outerExpand / 2,
    CELL_SIZE + outerExpand,
    CELL_SIZE + outerExpand,
  );

  // Inner ring — slightly slower, more saturated orange
  const innerExpand = Math.min(1, p * 1.4) * CELL_SIZE * 0.45;
  ctx.globalAlpha   = outerAlpha * 0.7;
  ctx.strokeStyle   = '#ffaa00';
  ctx.lineWidth     = 1.5;
  ctx.strokeRect(
    sx - innerExpand / 2,
    sy - innerExpand / 2,
    CELL_SIZE + innerExpand,
    CELL_SIZE + innerExpand,
  );

  ctx.globalAlpha = 1;
  ctx.lineWidth   = 1;
}

/**
 * Cure (antidote) — brief green flash on the player tile, then eight green
 * sparkle dots radiate outward and fade.
 */
function drawCureEffect(
  ctx: CanvasRenderingContext2D,
  anim: ConsumableAnimationState,
  vpLeft: number,
  vpTop: number,
): void {
  const sx = (anim.playerPos.x - vpLeft) * CELL_SIZE;
  const sy = (anim.playerPos.y - vpTop)  * CELL_SIZE;
  const cx = sx + CELL_SIZE / 2;
  const cy = sy + CELL_SIZE / 2;
  const p  = anim.progress;

  // Green tile flash (first 30% of animation)
  if (p < 0.3) {
    ctx.globalAlpha = ((0.3 - p) / 0.3) * 0.45;
    ctx.fillStyle   = '#44ff88';
    ctx.fillRect(sx, sy, CELL_SIZE, CELL_SIZE);
  }

  // Eight sparkle dots radiating outward
  const PARTICLE_COUNT = 8;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle  = (i / PARTICLE_COUNT) * Math.PI * 2;
    const radius = p * CELL_SIZE * 1.5;
    const px     = cx + Math.cos(angle) * radius;
    const py     = cy + Math.sin(angle) * radius;
    const alpha  = Math.max(0, 1 - p);

    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#55ee88';
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/**
 * Damage — arms a sprite on the player tile, then expands configured blast
 * sprites over the presenter-provided blast positions.
 */
function drawDamageEffect(
  ctx: CanvasRenderingContext2D,
  anim: ConsumableAnimationState,
  vpLeft: number,
  vpTop: number,
): void {
  const { playerPos, blastPositions, progress: p } = anim;
  const sx = (playerPos.x - vpLeft) * CELL_SIZE;
  const sy = (playerPos.y - vpTop)  * CELL_SIZE;

  const detonateAt = anim.presentation.detonateAtProgress;
  if (detonateAt === undefined) return;

  if (p < detonateAt) {
    // ── Phase 1: bomb arm ──────────────────────────────────────────
    const armProg = p / detonateAt;
    // Scale: 0 → 1 for first 60%, then a slight overshoot bounce
    const scale = armProg < 0.6
      ? armProg / 0.6
      : 1 + Math.sin(((armProg - 0.6) / 0.4) * Math.PI) * 0.18;
    const scaledSize = CELL_SIZE * scale;
    const scaleOff   = (CELL_SIZE - scaledSize) / 2;

    const bombSprite = anim.presentation.armSpriteName === undefined
      ? null
      : spriteRegistry.getSpriteByAtlasName(anim.presentation.armSpriteName);
    if (bombSprite) {
      ctx.drawImage(
        bombSprite.image,
        bombSprite.rect.x, bombSprite.rect.y,
        bombSprite.rect.w, bombSprite.rect.h,
        sx + scaleOff, sy + scaleOff,
        scaledSize, scaledSize,
      );
    } else {
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(sx + scaleOff, sy + scaleOff, scaledSize, scaledSize);
    }
  } else {
    // ── Phase 2: blast expansion ───────────────────────────────────
    const blastProg = (p - detonateAt) / (1 - detonateAt);
    const spriteNames = anim.presentation.blastSpriteNames ?? [];

    for (let i = 0; i < blastPositions.length; i += 1) {
      const pos = blastPositions[i];
      if (!pos) continue;

      const bsx = (pos.x - vpLeft) * CELL_SIZE;
      const bsy = (pos.y - vpTop)  * CELL_SIZE;

      // Centre fires immediately; outer tiles lag by 15%
      const isCenter  = i === 0;
      const tileDelay = isCenter ? 0 : 0.15;
      const tileProg  = Math.max(0, Math.min(1, (blastProg - tileDelay) / (1 - tileDelay)));
      if (tileProg <= 0) continue;

      // Fast scale-in, then hold, then fade out
      const tileScale = tileProg < 0.3 ? tileProg / 0.3 : 1.0;
      const tileAlpha = tileProg > 0.55
        ? Math.max(0, 1 - (tileProg - 0.55) / 0.45)
        : 1.0;

      const scaledSize = CELL_SIZE * tileScale;
      const scaleOff   = (CELL_SIZE - scaledSize) / 2;

      ctx.globalAlpha = tileAlpha;

      const spriteName = spriteNames[i];
      const sprite = spriteName === undefined ? null : spriteRegistry.getSpriteByAtlasName(spriteName);

      if (sprite) {
        ctx.drawImage(
          sprite.image,
          sprite.rect.x, sprite.rect.y,
          sprite.rect.w, sprite.rect.h,
          bsx + scaleOff, bsy + scaleOff,
          scaledSize, scaledSize,
        );
      } else {
        // Fallback gradient orange rect
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(bsx + scaleOff, bsy + scaleOff, scaledSize, scaledSize);
      }
    }

    ctx.globalAlpha = 1;
  }
}

/**
 * Dispatch to the appropriate per-effect drawing function.
 * Called after the entity layer so effects appear on top.
 */
function drawConsumableEffects(
  ctx: CanvasRenderingContext2D,
  animations: ConsumableAnimationState[],
  vpLeft: number,
  vpTop: number,
): void {
  for (const anim of animations) {
    ctx.save();
    switch (anim.presentation.kind) {
      case 'heal_hearts':   drawHealEffect(ctx, anim, vpLeft, vpTop);   break;
      case 'buff_rings':    drawBuffEffect(ctx, anim, vpLeft, vpTop);   break;
      case 'cure_sparkles': drawCureEffect(ctx, anim, vpLeft, vpTop);   break;
      case 'bomb_blast':    drawDamageEffect(ctx, anim, vpLeft, vpTop); break;
    }
    ctx.restore();
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
  consumableAnimations: ConsumableAnimationState[] = [],
  playerEffects: PlayerEffects = {},
): void {
  ctx.clearRect(0, 0, vpWidth * CELL_SIZE, vpHeight * CELL_SIZE);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, vpWidth * CELL_SIZE, vpHeight * CELL_SIZE);
  const resolvedPlayerEffects = resolvePlayerEffects(playerEffects);

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

  // ── Draw cells, then entities on top ──────────────────────────────
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

      const isPlayer = entity.type === 'player';
      const entityScale = isPlayer ? resolvedPlayerEffects.entityScale : 1.0;

      drawEntity(ctx, entity, screenX, screenY, offsetX, offsetY, entityScale);

      const ring = isPlayer ? resolvedPlayerEffects.ring : undefined;
      if (ring !== undefined) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / ring.pulsePeriodMs);
        ctx.strokeStyle = `rgba(${ring.colorRgb}, ${ring.alphaBase + pulse * ring.alphaAmplitude})`;
        ctx.lineWidth = ring.lineWidth;
        ctx.strokeRect(
          screenX + offsetX - ring.paddingPx,
          screenY + offsetY - ring.paddingPx,
          CELL_SIZE + ring.paddingPx * 2,
          CELL_SIZE + ring.paddingPx * 2,
        );
        ctx.lineWidth = 1;
      }

      // ── Instance colour square for disambiguation ─────────────────────
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

  // ── Consumable effects (drawn above the entity layer) ────────────
  drawConsumableEffects(ctx, consumableAnimations, vpLeft, vpTop);
}
