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
    ctx.save();

    // Inner gold ring
    const innerRadius = 5 + progress * 15;
    helpers.drawRing(ctx, x, y, innerRadius, 2, '255, 200, 0', 1 - progress);

    // Outer orange ring
    const outerRadius = 10 + progress * 25;
    helpers.drawRing(ctx, x, y, outerRadius, 2, '255, 150, 0', 0.5 * (1 - progress));

    ctx.restore();
  },
};
