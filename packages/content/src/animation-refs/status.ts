/**
 * Status animations — persistent visual overlays that persist while a status is active.
 * Ring pulses, status markers, damage indicators on affected entities.
 */

import type { AnimationRef } from './types.js';

export const goldRingPulse = {
  id: 'fx.status.gold-ring-pulse',
  category: 'status',
  durationMs: 180,
} as const satisfies AnimationRef;
