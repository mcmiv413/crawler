/**
 * Axe Execute animation — finishing strike with heavy downward impact.
 * Large orange/red burst with downward direction.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const axeExecuteModule: AnimationModule = {
  id: animationRefs.impact.executionStrike.id,
  durationMs: animationRefs.impact.executionStrike.durationMs,
  category: animationRefs.impact.executionStrike.category,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    let alpha: number;
    if (progress < 0.35) {
      alpha = easeOutCubic(progress / 0.35);
    } else if (progress < 0.55) {
      alpha = 1;
    } else {
      const fadeProgress = (progress - 0.55) / 0.45;
      const easeInCubic = (t: number) => t * t * t;
      alpha = 1 - easeInCubic(fadeProgress);
    }

    const maxRadius = 56;
    const displayProgress = progress < 0.35 ? easeOutCubic(progress / 0.35) : 1;
    const radius = displayProgress * maxRadius;

    ctx.save();
    ctx.fillStyle = `rgba(255, 150, 100, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 100, 50, ${alpha * 0.7})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Heavy downward impact rays
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const rayLength = 32;
      const endX = x + Math.cos(angle) * rayLength;
      const endY = y + Math.sin(angle) * rayLength;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // Central finisher glow
    ctx.fillStyle = `rgba(255, 180, 120, ${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};;
