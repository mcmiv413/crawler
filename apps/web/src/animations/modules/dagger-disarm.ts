/**
 * Dagger Disarm animation — sharp strike that disarms weapon.
 * Fast red slash with sparkle.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const daggerDisarmModule: AnimationModule = {
  id: 'fx.impact.disarm-strike',
  durationMs: 380,
  category: 'impact',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const easeProgress = progress * progress; // Quick burst effect
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.strokeStyle = `rgba(255, 100, 100, ${alpha * 0.8})`;
    ctx.lineWidth = 2;

    // Diagonal slash
    const slashLength = 30;
    const startX = x - slashLength * 0.5;
    const startY = y - slashLength * 0.5;
    const endX = x + slashLength * (1 - easeProgress);
    const endY = y + slashLength * (1 - easeProgress);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Sparkle
    ctx.fillStyle = `rgba(255, 200, 100, ${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(endX, endY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};
