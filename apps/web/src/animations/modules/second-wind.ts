/**
 * Second Wind animation — self-buff with healing/recovery aura.
 * Green spiraling energy around player.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const secondWindModule: AnimationModule = {
  id: 'fx.self.second-wind-buff',
  durationMs: 800,
  category: 'self',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const alpha = progress < 0.5 ? progress : Math.max(0, 1 - progress);

    ctx.save();
    ctx.strokeStyle = `rgba(100, 200, 100, ${alpha * 0.6})`;
    ctx.lineWidth = 2;

    // Draw spiral aura
    for (let i = 0; i < 3; i++) {
      const offset = (progress + i / 3) % 1;
      const radius = 12 + offset * 12;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center glow
    ctx.fillStyle = `rgba(150, 220, 150, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};
