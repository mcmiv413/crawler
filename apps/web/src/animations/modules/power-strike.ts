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

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: any): void {
    const { x, y, progress, durationMs } = anim;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const eased = easeOutCubic(progress);
    
    // Peak flash: hold at 1.0 for first 80ms, then ease out
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

    // Draw 8-ray starburst
    const maxRadius = 72;
    const radius = eased * maxRadius;
    const rayCount = 8;
    
    ctx.strokeStyle = `rgba(255, 220, 100, ${flashAlpha * 0.8})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const endX = x + Math.cos(angle) * radius;
      const endY = y + Math.sin(angle) * radius;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // Central flash disk
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.9})`;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};
