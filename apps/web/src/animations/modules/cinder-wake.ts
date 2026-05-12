import { animationRefs } from '@dungeon/content';
import type { AnimationDrawContext, AnimationModule, RendererHelpers } from '../types.js';

export const cinderWakeModule: AnimationModule = {
  id: animationRefs.aoe.cinderWake.id,
  durationMs: animationRefs.aoe.cinderWake.durationMs,
  category: animationRefs.aoe.cinderWake.category,
  suppressActorBump: animationRefs.aoe.cinderWake.suppressActorBump,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void {
    const positions = anim.blastPositions ?? [];
    for (const position of positions) {
      const radius = 8 + helpers.easeOutCubic(anim.progress) * 20;
      helpers.drawRing(ctx, position.x, position.y, radius, 2, '255, 116, 36', 1 - anim.progress);
      ctx.save();
      ctx.fillStyle = `rgba(120, 36, 18, ${0.35 * (1 - anim.progress)})`;
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
};
