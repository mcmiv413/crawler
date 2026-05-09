/**
 * Blade Bleed animation — bleeding strike with red spray effect.
 * Red particles scatter outward as the blade cuts.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const bladeBleedModule: AnimationModule = {
  id: 'fx.impact.bleeding-strike',
  durationMs: 400,
  category: 'impact',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const alpha = 1 - progress;

    ctx.save();
    ctx.fillStyle = `rgba(200, 50, 50, ${alpha * 0.6})`;

    // Draw 5 blood droplets scattering outward
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const distance = progress * 40;
      const dropX = x + Math.cos(angle) * distance;
      const dropY = y + Math.sin(angle) * distance;
      ctx.beginPath();
      ctx.arc(dropX, dropY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};
