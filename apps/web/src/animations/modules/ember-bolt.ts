import { animationRefs } from '@dungeon/content';
import type { AnimationDrawContext, AnimationModule, RendererHelpers } from '../types.js';

export const emberBoltModule: AnimationModule = {
  id: animationRefs.projectile.emberBolt.id,
  durationMs: animationRefs.projectile.emberBolt.durationMs,
  category: animationRefs.projectile.emberBolt.category,
  suppressActorBump: animationRefs.projectile.emberBolt.suppressActorBump,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void {
    const target = anim.targetPos ?? { x: anim.x, y: anim.y };
    helpers.drawParticleStream(ctx, anim.x, anim.y, target.x, target.y, 10, anim.progress);
    ctx.save();
    ctx.fillStyle = `rgba(255, 104, 28, ${1 - anim.progress * 0.4})`;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 5 + anim.progress * 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};
