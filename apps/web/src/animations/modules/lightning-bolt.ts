/**
 * Lightning Bolt animation — bright electrical projectile traveling to target.
 * Blue-white streak with electrical particles.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationDrawContext, AnimationModule, RendererHelpers } from '../types.js';

export const lightningBoltModule: AnimationModule = {
  id: animationRefs.projectile.lightningBolt.id,
  durationMs: animationRefs.projectile.lightningBolt.durationMs,
  category: animationRefs.projectile.lightningBolt.category,
  suppressActorBump: animationRefs.projectile.lightningBolt.suppressActorBump,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void {
    const target = anim.targetPos ?? { x: anim.x, y: anim.y };

    // Draw electrical trail
    helpers.drawParticleStream(ctx, anim.x, anim.y, target.x, target.y, 8, anim.progress);

    ctx.save();

    // Main bolt glow
    const glowAlpha = 1 - anim.progress * 0.3;
    ctx.fillStyle = `rgba(100, 200, 255, ${glowAlpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 6 + anim.progress * 8, 0, Math.PI * 2);
    ctx.fill();

    // Core bright bolt
    ctx.fillStyle = `rgba(200, 220, 255, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 3 + anim.progress * 4, 0, Math.PI * 2);
    ctx.fill();

    // Spark points
    ctx.fillStyle = `rgba(255, 255, 150, ${glowAlpha * 0.8})`;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + anim.progress * Math.PI;
      const sparkDist = 8 + anim.progress * 6;
      const sparkX = target.x + Math.cos(angle) * sparkDist;
      const sparkY = target.y + Math.sin(angle) * sparkDist;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};
