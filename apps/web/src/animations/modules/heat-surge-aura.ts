import { animationRefs } from '@dungeon/content';
import type { AnimationDrawContext, AnimationModule, RendererHelpers } from '../types.js';

export const heatSurgeAuraModule: AnimationModule = {
  id: animationRefs.self.heatSurgeAura.id,
  durationMs: animationRefs.self.heatSurgeAura.durationMs,
  category: animationRefs.self.heatSurgeAura.category,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void {
    const eased = helpers.easeOutCubic(anim.progress);
    helpers.drawRing(ctx, anim.x, anim.y, 10 + eased * 30, 3, '255, 96, 32', 1 - anim.progress);
    helpers.drawRing(ctx, anim.x, anim.y, 18 + eased * 42, 2, '255, 196, 64', 0.55 * (1 - anim.progress));
  },
};
