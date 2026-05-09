/**
 * Dagger Set Trap animation — placing a trap at location.
 * Sparkle and placement effect.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const daggerSetTrapModule: AnimationModule = {
  id: 'fx.utility.trap-placement',
  durationMs: 500,
  category: 'utility',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const alpha = progress < 0.3 ? progress / 0.3 : Math.max(0, 1 - (progress - 0.3) / 0.7);

    ctx.save();
    ctx.fillStyle = `rgba(150, 150, 255, ${alpha * 0.6})`;

    // Draw expanding trap symbol (like a tripwire)
    const size = 8 + progress * 12;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Draw sparkle particles
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const dist = 10 + progress * 15;
      const sparkX = x + Math.cos(angle) * dist;
      const sparkY = y + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(200, 200, 255, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};
