/**
 * Ranged Volley animation — multiple arrows in rapid succession.
 * Many arrows spreading outward from player position.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const rangedVolleyModule: AnimationModule = {
  id: 'fx.projectile.arrow-volley',
  durationMs: 400,
  category: 'projectile',
  suppressActorBump: true,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const alpha = Math.max(0, 1 - progress * 1.2);
    const distance = progress * 50;

    ctx.save();
    ctx.fillStyle = `rgba(180, 150, 100, ${alpha * 0.8})`;
    ctx.strokeStyle = `rgba(100, 50, 0, ${alpha})`;
    ctx.lineWidth = 1;

    // Draw 8 arrows in different directions
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const arrowX = x + Math.cos(angle) * distance;
      const arrowY = y + Math.sin(angle) * distance;

      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(angle);

      // Draw arrow
      const arrowLength = 14;
      ctx.beginPath();
      ctx.moveTo(-arrowLength / 2, 0);
      ctx.lineTo(arrowLength / 2, 0);
      ctx.stroke();

      // Draw arrow head
      ctx.beginPath();
      ctx.moveTo(arrowLength / 2, 0);
      ctx.lineTo(arrowLength / 2 - 3, -2);
      ctx.lineTo(arrowLength / 2 - 3, 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  },
};
