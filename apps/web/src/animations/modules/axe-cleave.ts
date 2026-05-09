/**
 * Axe Cleave animation — wide sweeping area attack.
 * Concentric semicircles showing sweep direction.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const axeCleavModule: AnimationModule = {
  id: 'fx.aoe.cleave-arc',
  durationMs: 450,
  category: 'aoe',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const maxRadius = 60;
    const radius = progress * maxRadius;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.strokeStyle = `rgba(200, 100, 50, ${alpha * 0.7})`;
    ctx.lineWidth = 3;

    // Draw sweeping arcs
    for (let i = 0; i < 3; i++) {
      const arcRadius = radius * (1 - i * 0.25);
      if (arcRadius > 0) {
        ctx.beginPath();
        ctx.arc(x, y, arcRadius, -Math.PI / 4, Math.PI / 4);
        ctx.stroke();
      }
    }

    // Directional indicator
    ctx.fillStyle = `rgba(255, 150, 50, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(x + radius * 0.7, y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};
