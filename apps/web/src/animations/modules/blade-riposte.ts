/**
 * Blade Riposte animation — fast counter with gleaming flash.
 * Bright white glint with quick animation for swift counterattack.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const bladeRiposteModule: AnimationModule = {
  id: animationRefs.impact.riposteGlint.id,
  durationMs: animationRefs.impact.riposteGlint.durationMs,
  category: animationRefs.impact.riposteGlint.category,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    let alpha: number;
    if (progress < 0.32) {
      alpha = easeOutCubic(progress / 0.32);
    } else if (progress < 0.6) {
      alpha = 1;
    } else {
      const fadeProgress = (progress - 0.6) / 0.4;
      const easeInCubic = (t: number) => t * t * t;
      alpha = 1 - easeInCubic(fadeProgress);
    }

    const maxRadius = 48;
    const displayProgress = progress < 0.32 ? easeOutCubic(progress / 0.32) : 1;
    const radius = displayProgress * maxRadius;

    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 150, ${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Central bright glint
    ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};;
