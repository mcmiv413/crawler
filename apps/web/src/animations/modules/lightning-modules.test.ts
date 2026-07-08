/**
 * Test layer: unit
 * Behavior: Lightning animation modules draw projectile and impact effects and register both modules in the 2D animation registry.
 * Proof: Assertions check lightningBoltModule passes source/target coordinates to drawParticleStream, lightningStrikeModule calls stroke three times and arc ten times, and resolveModule returns the bolt and strike module instances after initialization.
 * Validation: pnpm vitest run apps/web/src/animations/modules/lightning-modules.test.ts
 */
import { describe, expect, it, vi } from 'vitest';
import { resolveModule } from '../registry.js';
import { initializeAnimationModules } from '../generated/index.js';
import { createMockCanvasContext, runAnimationContract } from '../testing/run-animation-contract.js';
import { lightningBoltModule } from './lightning-bolt.js';
import { lightningStrikeModule } from './lightning-strike.js';

describe('lightningBoltModule', () => {
  runAnimationContract(lightningBoltModule);

  it('routes its particle stream from source to target', () => {
    const ctx = createMockCanvasContext();
    const drawParticleStream = vi.fn();

    lightningBoltModule.draw(
      ctx,
      {
        progress: 0.25,
        x: 10,
        y: 20,
        durationMs: lightningBoltModule.durationMs,
        targetPos: { x: 40, y: 50 },
      },
      { drawParticleStream } as any,
    );

    expect(drawParticleStream).toHaveBeenCalledWith(ctx, 10, 20, 40, 50, 8, 0.25);
  });
});

describe('lightningStrikeModule', () => {
  runAnimationContract(lightningStrikeModule);

  it('draws multiple strike paths and impact sparks', () => {
    const ctx = createMockCanvasContext();

    lightningStrikeModule.draw(ctx, {
      progress: 0.1,
      x: 32,
      y: 48,
      durationMs: lightningStrikeModule.durationMs,
    }, {} as any);

    expect(ctx.stroke).toHaveBeenCalledTimes(3);
    expect(ctx.arc).toHaveBeenCalledTimes(10);
  });
});

describe('lightning module registration', () => {
  it('registers lightning projectile and impact modules in the 2D registry', () => {
    initializeAnimationModules();

    expect(resolveModule(lightningBoltModule.id)).toBe(lightningBoltModule);
    expect(resolveModule(lightningStrikeModule.id)).toBe(lightningStrikeModule);
  });
});
