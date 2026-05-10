/**
 * Stamina Surge animation — used by Strength Elixir and Second Wind.
 * Concentric rings expand and fade.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext, RendererHelpers } from '../types.js';

export const staminaSurgeModule: AnimationModule = {
  id: animationRefs.self.staminaSurge.id,
  durationMs: animationRefs.self.staminaSurge.durationMs,
  category: animationRefs.self.staminaSurge.category,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void {
    const { x, y, progress } = anim;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    let alpha: number;
    if (progress < 0.3) {
      alpha = easeOutCubic(progress / 0.3);
    } else if (progress < 0.5) {
      alpha = 1;
    } else {
      const fadeProgress = (progress - 0.5) / 0.5;
      const easeInCubic = (t: number) => t * t * t;
      alpha = 1 - easeInCubic(fadeProgress);
    }

    const displayProgress = progress < 0.3 ? easeOutCubic(progress / 0.3) : 1;

    ctx.save();

    // Inner gold ring
    const innerRadius = 8 + displayProgress * 20;
    helpers.drawRing(ctx, x, y, innerRadius, 2, '255, 220, 80', alpha * 0.8);

    // Outer orange ring
    const outerRadius = 16 + displayProgress * 32;
    helpers.drawRing(ctx, x, y, outerRadius, 2, '255, 180, 50', alpha * 0.6);

    // Central glow
    ctx.fillStyle = `rgba(255, 240, 150, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, innerRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};;
