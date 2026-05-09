/**
 * Bomb Blast animation — used by Bomb consumable.
 * Bomb sprite scales in with overshoot, then blast sprites expand over blast positions.
 */

import { animationRefs } from '@dungeon/content/animation-refs';
import type { AnimationModule, AnimationDrawContext, RendererHelpers } from '../types.js';

export const bombBlastModule: AnimationModule = {
  id: animationRefs.aoe.bombBlast.id,
  durationMs: animationRefs.aoe.bombBlast.durationMs,
  category: animationRefs.aoe.bombBlast.category,
  suppressActorBump: animationRefs.aoe.bombBlast.suppressActorBump,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void {
    const { x, y, progress, blastPositions } = anim;
    const detonateAt = 0.3;

    ctx.save();

    // Phase 1: Arm phase (scale up with overshoot)
    if (progress < detonateAt) {
      const armProgress = progress / detonateAt;
      const scale = 1 + armProgress * 1.5 + Math.sin(armProgress * Math.PI) * 0.3;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }

    // Phase 2: Blast phase (expand sprites over blast positions)
    if (progress >= detonateAt && blastPositions && blastPositions.length > 0) {
      const blastProgress = (progress - detonateAt) / (1 - detonateAt);
      const blastRadius = blastProgress * 20;
      const blastAlpha = 1 - blastProgress;

      ctx.fillStyle = `rgba(255, 150, 0, ${blastAlpha * 0.7})`;
      for (const pos of blastPositions) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, blastRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  },
};
