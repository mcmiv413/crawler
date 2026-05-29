/**
 * Status animations — persistent visual overlays that persist while a status is active.
 * Ring pulses, status markers, damage indicators on affected entities.
 */

import type { AnimationRef } from './types.js';

export const goldRingPulse = {
  id: 'fx.status.gold-ring-pulse',
  category: 'status',
  durationMs: 180,
  impactFrameMs: 90,
  recoveryMs: 90,
} as const satisfies AnimationRef;

export const heatSurgeRing = {
  id: 'fx.status.heat-surge-ring',
  category: 'status',
  durationMs: 160,
  impactFrameMs: 80,
  recoveryMs: 80,
} as const satisfies AnimationRef;

export const arcaneChargeRing = {
  id: 'fx.status.arcane-charge-ring',
  category: 'status',
  durationMs: 220,
  impactFrameMs: 110,
  recoveryMs: 110,
} as const satisfies AnimationRef;
