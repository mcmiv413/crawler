/**
 * Cure Sparkle animation — used by Antidote consumable.
 * Green tile flash followed by radiating sparkle dots.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext, RendererHelpers } from '../types.js';

export const cureSparkleModule: AnimationModule = {
  id: animationRefs.self.cureSparkle.id,
  durationMs: animationRefs.self.cureSparkle.durationMs,
  category: animationRefs.self.cureSparkle.category,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void {
    const { x, y, progress } = anim;
    ctx.save();

    // Phase 1: Green tile flash (first 30%)
    if (progress < 0.3) {
      const flashAlpha = (0.3 - progress) / 0.3;
      ctx.fillStyle = `rgba(0, 200, 100, ${flashAlpha * 0.3})`;
      ctx.fillRect(x - 8, y - 8, 16, 16);
    }

    // Phase 2: Sparkle radiation (after 30%)
    const sparkleProgress = Math.max(0, progress - 0.3) / 0.7;
    const radiusMax = sparkleProgress * 25;

    ctx.fillStyle = `rgba(100, 255, 150, ${(1 - sparkleProgress) * 0.8})`;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const px = x + Math.cos(angle) * radiusMax;
      const py = y + Math.sin(angle) * radiusMax;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};
