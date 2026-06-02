/**
 * Lightning Strike animation — vertical electrical discharge with branching.
 * Bright blue-white flash with multiple jagged paths and impact.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const lightningStrikeModule: AnimationModule = {
  id: animationRefs.impact.lightningStrike.id,
  durationMs: animationRefs.impact.lightningStrike.durationMs,
  category: animationRefs.impact.lightningStrike.category,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext): void {
    const { x, y, progress } = anim;

    // Lightning mainly appears at start, then fades
    let alpha: number;
    if (progress < 0.25) {
      alpha = 1;
    } else if (progress < 0.5) {
      alpha = 1 - (progress - 0.25) / 0.25;
    } else {
      alpha = 0;
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Draw main strike bolt (vertical)
    const strikeWidth = 8;
    const strikeHeight = 60;

    // Main bright inner bolt
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = strikeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Jagged lightning path with branches
    const drawBolt = (startX: number, startY: number, endX: number, endY: number, segments: number, variance: number) => {
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const baseX = startX + (endX - startX) * t;
        const baseY = startY + (endY - startY) * t;

        // Pseudo-random jag based on position
        const jag = Math.sin(baseY * 0.05 + progress * 10) * variance;
        ctx.lineTo(baseX + jag, baseY);
      }

      ctx.stroke();
    };

    // Main vertical strike
    ctx.shadowColor = `rgba(100, 200, 255, ${alpha * 0.6})`;
    ctx.shadowBlur = 20;
    drawBolt(x, y - strikeHeight / 2, x, y + strikeHeight / 2, 10, 5);

    // Left branch
    ctx.strokeStyle = `rgba(200, 220, 255, ${alpha * 0.7})`;
    ctx.lineWidth = 4;
    drawBolt(x - 15, y - 20, x - 25, y + 15, 6, 3);

    // Right branch
    ctx.strokeStyle = `rgba(200, 220, 255, ${alpha * 0.7})`;
    ctx.lineWidth = 4;
    drawBolt(x + 15, y - 20, x + 25, y + 15, 6, 3);

    // Glow circle at impact point
    ctx.fillStyle = `rgba(100, 200, 255, ${alpha * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();

    // Brighter inner glow
    ctx.fillStyle = `rgba(150, 220, 255, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle points around impact
    ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.8})`;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const sparkDist = 25;
      const sparkX = x + Math.cos(angle) * sparkDist;
      const sparkY = y + Math.sin(angle) * sparkDist;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};
