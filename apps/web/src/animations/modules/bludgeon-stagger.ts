/**
 * Bludgeon Stagger animation — knockback shockwave.
 * Concentric rings with purple/blue coloring for crowd control.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const bludgeonStaggerModule: AnimationModule = {
  id: 'fx.impact.stagger-shockwave',
  durationMs: 300,
  category: 'impact',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    let alpha: number;
    if (progress < 0.3) {
      alpha = easeOutCubic(progress / 0.3);
    } else if (progress < 0.5) {
      alpha = 1;
    } else {
      const fadeProgress = (progress - 0.5) / 0.5;
      const easeInCubic = (t: number) => t * t * t;
      alpha = 1 - easeInCubic(fadeProgress);
    }

    const maxRadius = 64;
    const displayProgress = progress < 0.3 ? easeOutCubic(progress / 0.3) : 1;
    const radius = displayProgress * maxRadius;

    ctx.save();
    ctx.strokeStyle = `rgba(150, 100, 200, ${alpha * 0.7})`;
    ctx.lineWidth = 3;

    // Draw 3 expanding shock rings
    for (let i = 0; i < 3; i++) {
      const ringRadius = radius - (i * 16);
      if (ringRadius > 0) {
        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Central impact flash
    ctx.fillStyle = `rgba(200, 150, 255, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};;
