/**
 * Trap Spark animation — compact burst for trap triggers without a more specific hazard module.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const trapSparkModule: AnimationModule = {
  id: animationRefs.utility.trapSpark.id,
  durationMs: animationRefs.utility.trapSpark.durationMs,
  category: animationRefs.utility.trapSpark.category,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const alpha = Math.max(0, 1 - progress);
    const radius = 6 + progress * 22;

    ctx.save();
    ctx.strokeStyle = `rgba(255, 220, 80, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 245, 160, ${alpha})`;
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      const sparkDistance = radius * 0.8;
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(angle) * sparkDistance,
        y + Math.sin(angle) * sparkDistance,
        2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.restore();
  },
};
