import type { ConsumableAnimationPresentationView } from '@dungeon/presenter';
import { CELL_SIZE } from '../config/ui-config.js';
import { spriteRegistry } from './sprite-registry.js';

export interface ConsumableAnimationState {
  id: string;
  effect: 'heal' | 'buff' | 'cure' | 'damage';
  playerPos: { x: number; y: number };
  blastPositions: readonly { x: number; y: number }[];
  startTime: number;
  progress: number;
  durationMs: number;
  presentation: ConsumableAnimationPresentationView;
  animationId?: string;
}

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

export function drawConsumableFallbackEffects(
  ctx: CanvasRenderingContext2D,
  anim: ConsumableAnimationState,
  vpLeft: number,
  vpTop: number,
): void {
  switch (anim.presentation.kind) {
    case 'heal_hearts':   drawHealEffect(ctx, anim, vpLeft, vpTop);   break;
    case 'buff_rings':    drawBuffEffect(ctx, anim, vpLeft, vpTop);   break;
    case 'cure_sparkles': drawCureEffect(ctx, anim, vpLeft, vpTop);   break;
    case 'bomb_blast':    drawDamageEffect(ctx, anim, vpLeft, vpTop); break;
  }
}
