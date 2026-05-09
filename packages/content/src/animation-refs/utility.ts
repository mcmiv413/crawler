/**
 * Utility animations — traps, environmental effects, setup animations.
 * Placement, disarming, spark effects, non-combat visual feedback.
 */

import type { AnimationRef } from './types.js';

export const trapSpark = {
  id: 'fx.utility.trap-spark',
  category: 'utility',
  durationMs: 350,
} as const satisfies AnimationRef;

export const trapPlacement = {
  id: 'fx.utility.trap-placement',
  category: 'utility',
  durationMs: 500,
} as const satisfies AnimationRef;
