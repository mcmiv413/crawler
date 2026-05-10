/**
 * Healing Pulse animation — used by Health Potion consumable.
 * Red heart sprites float upward with fade.
 */

import { animationRefs } from '@dungeon/content';
import type { AnimationModule, AnimationDrawContext, RendererHelpers } from '../types.js';

export const healingPulseModule: AnimationModule = {
  id: animationRefs.self.healingPulse.id,
  durationMs: animationRefs.self.healingPulse.durationMs,
  category: animationRefs.self.healingPulse.category,

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

    const riseAmount = progress * 2.2 * 16;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Draw 3 heart sprites rising
    for (let i = 0; i < 3; i++) {
      const offsetX = (i - 1) * 8;
      const offsetY = -riseAmount + (i * 0.12 * riseAmount);
      
      ctx.fillStyle = `rgba(220, 50, 50, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x + offsetX, y + offsetY, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Outer glow
      ctx.strokeStyle = `rgba(255, 100, 100, ${alpha * 0.6})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  },
};;
