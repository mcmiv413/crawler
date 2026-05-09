/**
 * Bludgeon Stagger animation — knockback shockwave.
 * Concentric rings with purple/blue coloring for crowd control.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const bludgeonStaggerModule: AnimationModule = {
  id: 'fx.impact.stagger-shockwave',
  durationMs: 380,
  category: 'impact',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const maxRadius = 56;
    const radius = progress * maxRadius;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.strokeStyle = `rgba(150, 100, 200, ${alpha * 0.7})`;
    ctx.lineWidth = 3;

    // Draw 2 expanding shock rings
    for (let i = 0; i < 2; i++) {
      const ringRadius = radius - (i * 16);
      if (ringRadius > 0) {
        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  },
};
