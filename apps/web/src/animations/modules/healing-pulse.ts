/**
 * Healing Pulse animation — used by Health Potion consumable.
 * Red heart sprites float upward with fade.
 */

import { animationRefs } from '@dungeon/content/animation-refs';
import type { AnimationModule, AnimationDrawContext, RendererHelpers } from '../types.js';

export const healingPulseModule: AnimationModule = {
  id: animationRefs.self.healingPulse.id,
  durationMs: animationRefs.self.healingPulse.durationMs,
  category: animationRefs.self.healingPulse.category,

  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void {
    const { x, y, progress } = anim;
    const riseAmount = progress * 1.8 * 16; // 1.8 cells rise
    const alpha = 1 - progress;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'red';

    // Draw 3 heart sprites (simplified as circles)
    for (let i = 0; i < 3; i++) {
      const offsetX = (i - 1) * 8;
      const offsetY = -riseAmount + (i * 0.15 * riseAmount);
      ctx.beginPath();
      ctx.arc(x + offsetX, y + offsetY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};
