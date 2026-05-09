/**
 * Gold Ring Pulse — status overlay for Strength buff.
 * Pulsing gold ring around entity while status is active.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext, RendererHelpers } from '../types.js';

export const goldRingPulseModule: AnimationModule = {
  id: animationRefs.status.goldRingPulse.id,
  durationMs: animationRefs.status.goldRingPulse.durationMs,
  category: animationRefs.status.goldRingPulse.category,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void {
    const { x, y } = anim;

    ctx.save();

    // Pulsing ring using decaying sine
    const pulse = helpers.decayingSine(anim.progress, 3); // 3 cycles over duration
    const radius = 14 + pulse * 4;
    const baseAlpha = 0.7;
    const alpha = baseAlpha + pulse * 0.3;

    helpers.drawRing(ctx, x, y, radius, 2, '255, 200, 0', alpha);

    ctx.restore();
  },
};
