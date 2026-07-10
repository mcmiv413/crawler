/**
 * Test layer: unit
 * Behavior: Trap animation modules draw placement, disarm, and trigger fallback effects and register through the generated 2D animation registry.
 * Proof: Assertions run the shared animation contract, inspect trap-spark canvas calls, and require registry resolution for trap placement, disarm strike, and trap spark.
 * Validation: pnpm vitest run apps/web/src/animations/modules/trap-modules.test.ts
 */
import { describe, expect, it } from 'vitest';
import { resolveModule } from '../registry.js';
import { initializeAnimationModules } from '../generated/index.js';
import { createMockCanvasContext, runAnimationContract } from '../testing/run-animation-contract.js';
import { daggerDisarmModule } from './dagger-disarm.js';
import { daggerSetTrapModule } from './dagger-set-trap.js';
import { trapSparkModule } from './trap-spark.js';
import type { RendererHelpers } from '../types.js';

const noopHelpers: RendererHelpers = {
  drawRing: () => undefined,
  drawParticleStream: () => undefined,
  drawArrowAlong: () => undefined,
  easeOutCubic: (t: number) => t,
  easeInCubic: (t: number) => t,
  decayingSine: () => 0,
};

describe('trapSparkModule', () => {
  runAnimationContract(trapSparkModule);

  it('draws a trigger burst with ring and spark particles', () => {
    const ctx = createMockCanvasContext();

    trapSparkModule.draw(ctx, {
      progress: 0.25,
      x: 32,
      y: 48,
      durationMs: trapSparkModule.durationMs,
    }, noopHelpers);

    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.fill).toHaveBeenCalledTimes(10);
    expect(ctx.arc).toHaveBeenCalledTimes(11);
  });
});

describe('daggerSetTrapModule', () => {
  runAnimationContract(daggerSetTrapModule);
});

describe('daggerDisarmModule', () => {
  runAnimationContract(daggerDisarmModule);
});

describe('trap module registration', () => {
  it('registers placement, disarm, and trigger fallback modules in the 2D registry', () => {
    initializeAnimationModules();

    expect(resolveModule(daggerSetTrapModule.id)).toBe(daggerSetTrapModule);
    expect(resolveModule(daggerDisarmModule.id)).toBe(daggerDisarmModule);
    expect(resolveModule(trapSparkModule.id)).toBe(trapSparkModule);
  });
});
