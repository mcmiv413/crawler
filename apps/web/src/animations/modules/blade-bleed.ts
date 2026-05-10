/**
 * Blade Bleed animation — bleeding strike with red spray effect.
 * Red particles scatter outward as the blade cuts.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const bladeBleedModule: AnimationModule = {
  id: 'fx.impact.bleeding-strike',
  durationMs: 400,
  category: 'impact',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: any): void {
    const { x, y, progress, durationMs } = anim;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const eased = easeOutCubic(progress);

    // Peak flash: hold at 1.0 for 80ms, then fade
    const peakHold = 80 / durationMs;
    let flashAlpha = 0;
    if (progress < peakHold) {
      flashAlpha = 1.0;
    } else {
      const fadeProgress = (progress - peakHold) / (1 - peakHold);
      const easeInCubic = (t: number) => t * t * t;
      flashAlpha = Math.max(0, 1 - easeInCubic(fadeProgress));
    }

    ctx.save();

    // Crimson spray particles
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const baseDistance = 20 + (i % 3) * 8;
      const distance = eased * baseDistance;
      const particleX = x + Math.cos(angle) * distance;
      const particleY = y + Math.sin(angle) * distance;

      ctx.fillStyle = `rgba(220, 20, 20, ${flashAlpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(particleX, particleY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Central crimson glow
    ctx.fillStyle = `rgba(255, 100, 100, ${flashAlpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};
