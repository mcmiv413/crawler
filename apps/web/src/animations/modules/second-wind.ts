/**
 * Second Wind animation — self-buff with healing/recovery aura.
 * Green spiraling energy around player.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const secondWindModule: AnimationModule = {
  id: animationRefs.self.secondWindBuff.id,
  durationMs: animationRefs.self.secondWindBuff.durationMs,
  category: animationRefs.self.secondWindBuff.category,

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

    const maxRadius = 52;
    const displayProgress = progress < 0.3 ? easeOutCubic(progress / 0.3) : 1;
    const radius = displayProgress * maxRadius;

    ctx.save();
    ctx.strokeStyle = `rgba(100, 200, 100, ${alpha * 0.6})`;
    ctx.lineWidth = 2;

    // Draw 3 spiral rings
    for (let i = 0; i < 3; i++) {
      const offset = (progress * 1.5 + i / 3) % 1;
      const ringRadius = radius * (0.5 + offset * 0.5);
      ctx.beginPath();
      ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center buff glow
    ctx.fillStyle = `rgba(150, 220, 150, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};;
