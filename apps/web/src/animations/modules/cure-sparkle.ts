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
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    let alpha: number;
    if (progress < 0.3) {
      alpha = easeOutCubic(progress / 0.3);
    } else if (progress < 0.6) {
      alpha = 1;
    } else {
      const fadeProgress = (progress - 0.6) / 0.4;
      const easeInCubic = (t: number) => t * t * t;
      alpha = 1 - easeInCubic(fadeProgress);
    }

    ctx.save();

    // Phase 1: Green tile flash (first 30%)
    if (progress < 0.3) {
      const flashAlpha = (0.3 - progress) / 0.3;
      ctx.fillStyle = `rgba(0, 200, 100, ${flashAlpha * 0.4})`;
      ctx.fillRect(x - 8, y - 8, 16, 16);
    }

    // Phase 2: Sparkle radiation
    const displayProgress = progress < 0.3 ? easeOutCubic(progress / 0.3) : 1;
    const radiusMax = displayProgress * 40;

    ctx.fillStyle = `rgba(100, 255, 150, ${alpha * 0.7})`;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const px = x + Math.cos(angle) * radiusMax;
      const py = y + Math.sin(angle) * radiusMax;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Central bright core
    ctx.fillStyle = `rgba(150, 255, 180, ${alpha * 0.8})`;
    ctx.beginPath();
    ctx.arc(x, y, radiusMax * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};;
