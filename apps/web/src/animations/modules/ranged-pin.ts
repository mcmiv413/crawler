/**
 * Ranged Pin animation — single arrow projectile with impact.
 * Arrow travels from source to target with impact flash.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const rangedPinModule: AnimationModule = {
  id: 'fx.projectile.single-arrow',
  durationMs: 300,
  category: 'projectile',
  suppressActorBump: false,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.fillStyle = `rgba(180, 150, 100, ${alpha * 0.8})`;
    ctx.strokeStyle = `rgba(100, 50, 0, ${alpha})`;
    ctx.lineWidth = 1;

    // Draw arrow shaft
    const arrowLength = 16;
    ctx.beginPath();
    ctx.moveTo(x - arrowLength / 2, y);
    ctx.lineTo(x + arrowLength / 2, y);
    ctx.stroke();

    // Draw arrow head
    const headSize = 4;
    ctx.beginPath();
    ctx.moveTo(x + arrowLength / 2, y);
    ctx.lineTo(x + arrowLength / 2 - headSize, y - headSize / 2);
    ctx.lineTo(x + arrowLength / 2 - headSize, y + headSize / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },
};
