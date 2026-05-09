/**
 * Web animation module types and interfaces.
 *
 * AnimationModule is the core abstraction: a canvas draw function paired with metadata.
 * Web modules under apps/web/src/animations/modules/ export one module per catalog ref.
 */

import type { AnimationId, AnimationCategory } from '@dungeon/content/animation-refs';

/**
 * Context passed to AnimationModule.draw each frame.
 * Progress: 0 to 1 over the animation duration.
 */
export interface AnimationDrawContext {
  readonly progress: number;
  readonly x: number;
  readonly y: number;
  readonly durationMs: number;
  readonly targetPos?: { readonly x: number; readonly y: number };
  readonly blastPositions?: readonly { readonly x: number; readonly y: number }[];
  readonly targetHpFraction?: number;
}

/**
 * Helper utilities passed to AnimationModule.draw.
 * Pure canvas drawing functions, easing curves, etc.
 */
export interface RendererHelpers {
  drawStarBurst(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, points: number, progress: number): void;
  drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, thickness: number, color: string, alpha: number): void;
  drawParticleStream(ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number, count: number, progress: number): void;
  drawArrowAlong(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, progress: number): void;
  easeOutCubic(t: number): number;
  easeInCubic(t: number): number;
  decayingSine(t: number, frequency: number): number;
}

/**
 * Animation module: canvas implementation of a catalog animation ref.
 *
 * Each module:
 * - Sources id, durationMs, category, suppressActorBump from the catalog ref (never duplicates values)
 * - Implements a pure draw function that receives progress 0→1
 * - May be called multiple times per frame if stacked animations overlap
 */
export interface AnimationModule {
  readonly id: AnimationId;
  readonly durationMs: number;
  readonly category: AnimationCategory;
  readonly suppressActorBump?: boolean;
  draw(ctx: CanvasRenderingContext2D, anim: AnimationDrawContext, helpers: RendererHelpers): void;
}
