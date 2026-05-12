/**
 * Ranged Volley animation — multiple arrows in rapid succession.
 * Many arrows spreading outward from player position.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext } from '../types.js';

export const rangedVolleyModule: AnimationModule = {
  id: animationRefs.projectile.arrowVolley.id,
  durationMs: animationRefs.projectile.arrowVolley.durationMs,
  category: animationRefs.projectile.arrowVolley.category,
  suppressActorBump: animationRefs.projectile.arrowVolley.suppressActorBump,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: any): void {
    const { x, y, progress, blastPositions = [] } = anim;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const eased = easeOutCubic(progress);
    const alpha = Math.max(0, 1 - progress * 1.2);

    ctx.save();
    ctx.strokeStyle = `rgba(180, 150, 100, ${alpha * 0.9})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // If we have specific blast positions, draw arrow to each target
    if (blastPositions.length > 0) {
      for (const target of blastPositions) {
        const dx = target.x - x;
        const dy = target.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Arrow travels along the path
        const arrowDistance = eased * distance;
        const arrowX = x + Math.cos(angle) * arrowDistance;
        const arrowY = y + Math.sin(angle) * arrowDistance;

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);

        // Draw arrow shaft
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();

        // Draw arrow head
        ctx.fillStyle = `rgba(180, 150, 100, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(6, -2);
        ctx.lineTo(6, 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    } else {
      // Fallback: 8-compass arrows from player position
      const distance = eased * 50;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const arrowX = x + Math.cos(angle) * distance;
        const arrowY = y + Math.sin(angle) * distance;

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();

        ctx.fillStyle = `rgba(180, 150, 100, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(6, -2);
        ctx.lineTo(6, 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    }

    ctx.restore();
  },
};
