/**
 * Bludgeon Shatter animation — area blast with debris scatter.
 * Yellow/white explosion with particle burst effect.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const bludgeonShatterModule: AnimationModule = {
  id: 'fx.aoe.shatter-burst',
  durationMs: 420,
  category: 'aoe',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const maxRadius = 64;
    const radius = progress * maxRadius;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.fillStyle = `rgba(255, 220, 100, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 180, 50, ${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw debris chunks
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const distance = progress * 50;
      const chunkX = x + Math.cos(angle) * distance;
      const chunkY = y + Math.sin(angle) * distance;
      ctx.fillStyle = `rgba(200, 150, 80, ${alpha * 0.5})`;
      ctx.fillRect(chunkX - 2, chunkY - 2, 4, 4);
    }

    ctx.restore();
  },
};
