/**
 * Dagger Set Trap animation — placing a trap at location.
 * Sparkle and placement effect.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const daggerSetTrapModule: AnimationModule = {
  id: animationRefs.utility.trapPlacement.id,
  durationMs: animationRefs.utility.trapPlacement.durationMs,
  category: animationRefs.utility.trapPlacement.category,

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

    const maxRadius = 44;
    const displayProgress = progress < 0.3 ? easeOutCubic(progress / 0.3) : 1;
    const radius = displayProgress * maxRadius;

    ctx.save();
    ctx.fillStyle = `rgba(150, 150, 255, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(180, 180, 255, ${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw sparkle particles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const sparkDist = radius * 0.8;
      const sparkX = x + Math.cos(angle) * sparkDist;
      const sparkY = y + Math.sin(angle) * sparkDist;
      ctx.fillStyle = `rgba(200, 200, 255, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};;
