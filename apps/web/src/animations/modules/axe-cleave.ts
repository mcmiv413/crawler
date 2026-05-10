/**
 * Axe Cleave animation — wide sweeping area attack.
 * Concentric semicircles showing sweep direction.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const axeCleavModule: AnimationModule = {
  id: 'fx.aoe.cleave-arc',
  durationMs: 450,
  category: 'aoe',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: any): void {
    const { x, y, progress, durationMs } = anim;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const eased = easeOutCubic(progress);

    // Peak flash: hold at 1.0 for first 80ms
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

    // Sweeping arc with easing
    const maxRadius = 56;
    const radius = eased * maxRadius;
    
    ctx.strokeStyle = `rgba(200, 100, 50, ${flashAlpha * 0.8})`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Draw 3 concentric arcs sweeping in an arc
    for (let i = 0; i < 3; i++) {
      const arcRadius = radius * (1 - i * 0.25);
      if (arcRadius > 2) {
        ctx.beginPath();
        ctx.arc(x, y, arcRadius, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
      }
    }

    // Flash indicator at sweep end
    ctx.fillStyle = `rgba(255, 200, 100, ${flashAlpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(x + radius * 0.8, y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};
