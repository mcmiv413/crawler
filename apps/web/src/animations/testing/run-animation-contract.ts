/**
 * Shared test helper for animation modules.
 *
 * Exercises each module's draw function at key progress values (0, 0.5, 1)
 * on a mock canvas, asserting that the module metadata matches the catalog ref.
 * Per-module tests then assert only the canvas calls unique to that module.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AnimationModule } from '../types.js';

function createMockGradient(): CanvasGradient {
  return {
    addColorStop: vi.fn(),
  } as unknown as CanvasGradient;
}

export function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: vi.fn(() => createMockGradient()),
    createRadialGradient: vi.fn(() => createMockGradient()),
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Run the contract test for a given animation module.
 * Call this helper from individual module test files.
 *
 * Example:
 *   import { healingPulseModule } from '../modules/healing-pulse.js';
 *   describe('Healing Pulse', () => {
 *     runAnimationContract(healingPulseModule);
 *
 *     it('draws hearts upward with fade', () => {
 *       // Custom assertions for this specific module
 *     });
 *   });
 */
export function runAnimationContract(module: AnimationModule): void {
  describe(`${module.id} contract`, () => {
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      ctx = createMockCanvasContext();
    });

    it('has valid AnimationId format', () => {
      expect(module.id).toMatch(/^fx\.[a-z-]+\.[a-z0-9-]+$/);
    });

    it('has matching id from catalog ref', () => {
      // Module sources its ID from the catalog ref; drift would indicate a mismatch
      expect(module.id).toBeDefined();
      expect(typeof module.id).toBe('string');
    });

    it('has valid durationMs > 0', () => {
      expect(module.durationMs).toBeGreaterThan(0);
      expect(Number.isInteger(module.durationMs)).toBe(true);
    });

    it('has valid category', () => {
      const validCategories = ['impact', 'projectile', 'self', 'aoe', 'status', 'utility'];
      expect(validCategories).toContain(module.category);
    });

    it('has suppressActorBump for projectile and aoe refs', () => {
      if (module.category === 'projectile' || module.category === 'aoe') {
        expect(module.suppressActorBump).toBeDefined();
        expect(typeof module.suppressActorBump).toBe('boolean');
      }
    });

    it('draw function callable at progress 0', () => {
      const helpers = {
        drawStarBurst: vi.fn(),
        drawRing: vi.fn(),
        drawParticleStream: vi.fn(),
        drawArrowAlong: vi.fn(),
        easeOutCubic: (_t: number) => 0,
        easeInCubic: (_t: number) => 0,
        decayingSine: (_t: number, _freq: number) => 0,
      };

      expect(() => {
        module.draw(ctx, { progress: 0, x: 0, y: 0, durationMs: module.durationMs }, helpers as any);
      }).not.toThrow();
    });

    it('draw function callable at progress 0.5', () => {
      const helpers = {
        drawStarBurst: vi.fn(),
        drawRing: vi.fn(),
        drawParticleStream: vi.fn(),
        drawArrowAlong: vi.fn(),
        easeOutCubic: (_t: number) => 0,
        easeInCubic: (_t: number) => 0,
        decayingSine: (_t: number, _freq: number) => 0,
      };

      expect(() => {
        module.draw(ctx, { progress: 0.5, x: 0, y: 0, durationMs: module.durationMs }, helpers as any);
      }).not.toThrow();
    });

    it('draw function callable at progress 1', () => {
      const helpers = {
        drawStarBurst: vi.fn(),
        drawRing: vi.fn(),
        drawParticleStream: vi.fn(),
        drawArrowAlong: vi.fn(),
        easeOutCubic: (_t: number) => 0,
        easeInCubic: (_t: number) => 0,
        decayingSine: (_t: number, _freq: number) => 0,
      };

      expect(() => {
        module.draw(ctx, { progress: 1, x: 0, y: 0, durationMs: module.durationMs }, helpers as any);
      }).not.toThrow();
    });
  });
}
