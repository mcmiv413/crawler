/**
 * Axe Execute animation — finishing strike with heavy downward impact.
 * Large orange/red burst with downward direction.
 */

import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const axeExecuteModule: AnimationModule = {
  id: 'fx.impact.execution-strike',
  durationMs: 500,
  category: 'impact',

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;
    const downwardDistance = progress * 30;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.fillStyle = `rgba(255, 150, 100, ${alpha * 0.5})`;

    // Downward impact shape
    ctx.beginPath();
    ctx.arc(x, y + downwardDistance, 20 - progress * 10, 0, Math.PI * 2);
    ctx.fill();

    // Impact rays
    ctx.strokeStyle = `rgba(255, 100, 50, ${alpha * 0.7})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const rayLength = 25;
      const endX = x + Math.cos(angle) * rayLength;
      const endY = y + downwardDistance + Math.sin(angle) * rayLength;
      ctx.beginPath();
      ctx.moveTo(x, y + downwardDistance);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.restore();
  },
};
