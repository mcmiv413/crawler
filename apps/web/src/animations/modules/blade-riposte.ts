/**
 * Blade Riposte animation — fast counter with gleaming flash.
 * Bright white glint with quick animation for swift counterattack.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const bladeRiposteModule: AnimationModule = {
  id: 'fx.impact.riposte-glint',
  durationMs: 320,
  category: 'impact',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;

    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.7})`;

    // Draw diagonal flash
    const size = 12;
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size / 2, -2, size, 4);
    ctx.restore();
  },
};
