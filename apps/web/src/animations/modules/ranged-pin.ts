/**
 * Ranged Pin animation — single arrow projectile with impact.
 * Arrow travels from source to target with impact flash.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext, RendererHelpers } from '../types.js';

export const rangedPinModule: AnimationModule = {
  id: animationRefs.projectile.singleArrow.id,
  durationMs: animationRefs.projectile.singleArrow.durationMs,
  category: animationRefs.projectile.singleArrow.category,
  suppressActorBump: animationRefs.projectile.singleArrow.suppressActorBump,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void {
    const { x, y, progress, targetPos } = anim;
    const targetX = targetPos?.x ?? x;
    const targetY = targetPos?.y ?? y;
    const travelProgress = Math.min(progress / 0.78, 1);
    const impactProgress = Math.max(0, (progress - 0.72) / 0.28);

    const alpha = progress < 0.75 ? 1 : 1 - helpers.easeInCubic((progress - 0.75) / 0.25);

    ctx.save();
    ctx.globalAlpha = alpha;
    helpers.drawArrowAlong(ctx, x, y, targetX, targetY, helpers.easeOutCubic(travelProgress));

    if (impactProgress > 0) {
      const ringAlpha = 1 - helpers.easeInCubic(Math.min(impactProgress, 1));
      helpers.drawRing(ctx, targetX, targetY, 6 + impactProgress * 16, 2, '255, 200, 100', ringAlpha);
    }

    ctx.restore();
  },
};
