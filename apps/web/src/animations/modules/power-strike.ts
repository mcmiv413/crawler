/**
 * Power Strike animation — radial impact burst for universal heavy attack.
 * Concentric rings expand outward with bright white flash.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const powerStrikeModule: AnimationModule = {
  id: animationRefs.impact.radialImpactBurst.id,
  durationMs: animationRefs.impact.radialImpactBurst.durationMs,
  category: animationRefs.impact.radialImpactBurst.category,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const maxRadius = 48;
    const radius = progress * maxRadius;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
    ctx.lineWidth = 2;

    // Draw 3 expanding rings
    for (let i = 0; i < 3; i++) {
      const ringRadius = (radius * (1 - i * 0.3));
      if (ringRadius > 0) {
        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Flash at center
    ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};
