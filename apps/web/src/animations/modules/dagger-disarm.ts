/**
 * Dagger Disarm animation — sharp strike that disarms weapon.
 * Fast red slash with sparkle.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const daggerDisarmModule: AnimationModule = {
  id: 'fx.impact.disarm-strike',
  durationMs: 320,
  category: 'impact',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    let alpha: number;
    if (progress < 0.35) {
      alpha = easeOutCubic(progress / 0.35);
    } else if (progress < 0.5) {
      alpha = 1;
    } else {
      const fadeProgress = (progress - 0.5) / 0.5;
      const easeInCubic = (t: number) => t * t * t;
      alpha = 1 - easeInCubic(fadeProgress);
    }

    const maxRadius = 40;
    const displayProgress = progress < 0.35 ? easeOutCubic(progress / 0.35) : 1;
    const radius = displayProgress * maxRadius;

    ctx.save();
    ctx.strokeStyle = `rgba(255, 100, 100, ${alpha * 0.8})`;
    ctx.lineWidth = 2;

    // Diagonal slash
    const slashLength = 32;
    ctx.beginPath();
    ctx.moveTo(x - slashLength * 0.5, y - slashLength * 0.5);
    ctx.lineTo(x + slashLength * 0.5, y + slashLength * 0.5);
    ctx.stroke();

    // Impact circle
    ctx.strokeStyle = `rgba(255, 150, 100, ${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Sparkle effects
    ctx.fillStyle = `rgba(255, 200, 100, ${alpha * 0.6})`;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const sparkDist = radius * 0.7;
      const sparkX = x + Math.cos(angle) * sparkDist;
      const sparkY = y + Math.sin(angle) * sparkDist;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};;
