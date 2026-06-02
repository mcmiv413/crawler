import type { MapView, MapCellView, EntityView } from '@dungeon/presenter';
import type { StatusPresentationView } from '@dungeon/presenter';
import type { AnimationId } from '@dungeon/content';
import { resolveModule } from '../animations/registry.js';
import * as rendererHelpers from '../animations/helpers.js';
import { isAnimationOwnedByThree } from '../rendering/animation-dispatch-policy.js';
import {
  getMoveRenderedOffsetPx,
  getSquashStretchScale,
  type MoveTravelInput,
} from '../animations/move-style-profiles.js';
import { CELL_SIZE } from '../config/ui-config.js';
import { spriteRegistry } from './sprite-registry.js';
import { drawConsumableFallbackEffects, type ConsumableAnimationState } from './canvas-consumable-effects.js';

// ── Animation state interfaces ────────────────────────────────────
// Defined locally so the renderer has no dependency on React hooks.

interface BumpAnimationState {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerPos: { x: number; y: number };
  defenderPos: { x: number; y: number };
  durationMs: number;
  impactFrameMs: number;
  progress: number;
}

interface MoveAnimationState extends MoveTravelInput {
  id: string;
  entityId: string;
}



interface FxAnimationState {
  readonly id: string;
  readonly abilityId: string;
  readonly animationId: string;
  readonly playerPos: { readonly x: number; readonly y: number };
  readonly targetPos?: { readonly x: number; readonly y: number };
  readonly blastPositions: readonly { readonly x: number; readonly y: number }[];
  readonly targetHpFraction?: number;
  readonly durationMs: number;
  readonly suppressActorBump: boolean;
  readonly progress: number;
}

/** Player-level effects driven by active status conditions (not time-limited animations). */
interface PlayerEffects {
  readonly statusPresentations?: readonly StatusPresentationView[];
}

interface ResolvedPlayerEffects {
  readonly entityScale: number;
  readonly ring?: NonNullable<StatusPresentationView['ring']>;
}

interface CameraOffset {
  readonly x: number;
  readonly y: number;
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
  scaleX: number = 1.0,
  scaleY: number = scaleX,
): void {
  const width = CELL_SIZE * scaleX;
  const height = CELL_SIZE * scaleY;
  const centerX = screenX + offsetX + (CELL_SIZE / 2);
  const centerY = screenY + offsetY + (CELL_SIZE / 2);
  const drawX = -(width / 2);
  const drawY = -(height / 2);

  let sprite = null;
  if ('spriteName' in entity && entity.spriteName) {
    sprite = spriteRegistry.getSpriteByAtlasName(entity.spriteName);
  } else if (entity.type === 'player') {
    sprite = spriteRegistry.getSprite('player');
  }

  ctx.save();
  ctx.translate(centerX, centerY);

  if (sprite) {
    const { image, rect } = sprite;
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, drawX, drawY, width, height);
  } else {
    ctx.fillStyle = entity.color;
    ctx.font = `${Math.max(Math.min(width, height) - 2, 1)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.ascii, 0, 0);
  }

  ctx.restore();
}

// ── Draw all active FX animations using their registered modules ──
function drawFxAnimations(
  ctx: CanvasRenderingContext2D,
  animations: FxAnimationState[],
  vpLeft: number,
  vpTop: number,
  skipHandledAnimationIds?: readonly AnimationId[],
): void {
  for (const anim of animations) {
    const animationId = anim.animationId as AnimationId | undefined;
    if (isAnimationOwnedByThree(animationId, skipHandledAnimationIds ?? [])) continue;
    if (animationId === undefined) continue;

    const module = resolveModule(animationId);
    if (!module) continue;

    const worldAnchors = module.category === 'aoe' && anim.blastPositions.length > 0
      ? anim.blastPositions
      : (module.category === 'impact' || module.category === 'aoe') && anim.targetPos
        ? [anim.targetPos]
        : [anim.playerPos];

    const positions = worldAnchors.map((pos) => ({
      x: (pos.x - vpLeft) * CELL_SIZE + CELL_SIZE / 2,
      y: (pos.y - vpTop) * CELL_SIZE + CELL_SIZE / 2,
    }));

    // Draw at each position
    for (const screenPos of positions) {
      ctx.save();

      // Convert world target position if needed
      const screenTargetPos = anim.targetPos ? {
        x: (anim.targetPos.x - vpLeft) * CELL_SIZE + CELL_SIZE / 2,
        y: (anim.targetPos.y - vpTop) * CELL_SIZE + CELL_SIZE / 2,
      } : undefined;

      // Convert blast positions to screen coordinates
      const screenBlastPositions = anim.blastPositions.map(pos => ({
        x: (pos.x - vpLeft) * CELL_SIZE + CELL_SIZE / 2,
        y: (pos.y - vpTop) * CELL_SIZE + CELL_SIZE / 2,
      }));

      // Call the animation module's draw function
      module.draw(ctx, {
        x: screenPos.x,
        y: screenPos.y,
        progress: anim.progress,
        durationMs: anim.durationMs,
        targetPos: screenTargetPos,
        blastPositions: screenBlastPositions,
        targetHpFraction: anim.targetHpFraction,
        category: module.category,
      }, rendererHelpers);

      ctx.restore();
    }
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
  skipHandledAnimationIds?: readonly AnimationId[],
): void {
  for (const anim of animations) {
    const animationId = anim.animationId as AnimationId | undefined;
    if (isAnimationOwnedByThree(animationId, skipHandledAnimationIds ?? [])) continue;
    if (animationId !== undefined) {
      const module = resolveModule(animationId);
      if (module !== undefined) {
        const screenPlayerPos = {
          x: (anim.playerPos.x - vpLeft) * CELL_SIZE + CELL_SIZE / 2,
          y: (anim.playerPos.y - vpTop) * CELL_SIZE + CELL_SIZE / 2,
        };
        const screenBlastPositions = anim.blastPositions.map(pos => ({
          x: (pos.x - vpLeft) * CELL_SIZE + CELL_SIZE / 2,
          y: (pos.y - vpTop) * CELL_SIZE + CELL_SIZE / 2,
        }));

        ctx.save();
        module.draw(ctx, {
          x: screenPlayerPos.x,
          y: screenPlayerPos.y,
          progress: anim.progress,
          durationMs: anim.durationMs,
          blastPositions: screenBlastPositions,
          category: module.category,
        }, rendererHelpers);
        ctx.restore();
        continue;
      }
    }

    ctx.save();
    drawConsumableFallbackEffects(ctx, anim, vpLeft, vpTop);
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
  fxAnimations: FxAnimationState[] = [],
  playerEffects: PlayerEffects = {},
  cameraOffset: CameraOffset = { x: 0, y: 0 },
  skipHandledAnimationIds: readonly AnimationId[] = [],
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

  const overscanLeft = cameraOffset.x > 0.01 ? 1 : 0;
  const overscanRight = cameraOffset.x < -0.01 ? 1 : 0;
  const overscanTop = cameraOffset.y > 0.01 ? 1 : 0;
  const overscanBottom = cameraOffset.y < -0.01 ? 1 : 0;

  // ── Draw cells, then entities on top ──────────────────────────────
  ctx.save();
  ctx.translate(cameraOffset.x, cameraOffset.y);

  for (let gy = vpTop - overscanTop; gy < vpTop + vpHeight + overscanBottom; gy++) {
    for (let gx = vpLeft - overscanLeft; gx < vpLeft + vpWidth + overscanRight; gx++) {
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
      let moveScaleX = 1;
      let moveScaleY = 1;

      // ── Move offset ─────────────────────────────────────────────
      // Entity is already at toPos in game state. We render it offset
      // backward toward fromPos and decay that offset to zero.
      const move = moveLookup.get(entity.id);
      if (move) {
        const moveOffset = getMoveRenderedOffsetPx(move, CELL_SIZE, entity.id);
        const squashStretch = getSquashStretchScale(move.style, move.progress, move.walkPhase);
        offsetX += moveOffset.x;
        offsetY += moveOffset.y;
        moveScaleX *= squashStretch.scaleX;
        moveScaleY *= squashStretch.scaleY;
      }

      // ── Bump offset ─────────────────────────────────────────────
      // Stacks on top of any move offset — brief overlap is fine.
      const bump = bumpLookup.get(entity.id);
      if (bump) {
        const distance = 0.5;
        const impactProgress = bump.durationMs <= 0
          ? 0.5
          : Math.min(Math.max(bump.impactFrameMs / bump.durationMs, 0.05), 0.95);
        const easeProgress = bump.progress <= impactProgress
          ? bump.progress / impactProgress
          : 1 - ((bump.progress - impactProgress) / (1 - impactProgress));
        offsetX += (bump.defenderPos.x - bump.attackerPos.x) * CELL_SIZE * distance * easeProgress;
        offsetY += (bump.defenderPos.y - bump.attackerPos.y) * CELL_SIZE * distance * easeProgress;
      }

      const isPlayer = entity.type === 'player';
      const entityScale = isPlayer ? resolvedPlayerEffects.entityScale : 1.0;
      const scaleX = entityScale * moveScaleX;
      const scaleY = entityScale * moveScaleY;

      drawEntity(ctx, entity, screenX, screenY, offsetX, offsetY, scaleX, scaleY);

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
  drawConsumableEffects(ctx, consumableAnimations, vpLeft, vpTop, skipHandledAnimationIds);

  // ── FX animations (drawn above consumable effects) ─────────────
  drawFxAnimations(ctx, fxAnimations, vpLeft, vpTop, skipHandledAnimationIds);
  ctx.restore();
}
