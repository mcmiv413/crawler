/**
 * Utility animations — traps, environmental effects, setup animations.
 * Placement, disarming, spark effects, non-combat visual feedback.
 */

import type { AnimationRef } from './types.js';

export const trapSpark = {
  id: 'fx.utility.trap-spark',
  category: 'utility',
  durationMs: 350,
  impactFrameMs: 175,
  recoveryMs: 175,
} as const satisfies AnimationRef;

export const trapPlacement = {
  id: 'fx.utility.trap-placement',
  category: 'utility',
  durationMs: 500,
  impactFrameMs: 250,
  recoveryMs: 250,
} as const satisfies AnimationRef;
