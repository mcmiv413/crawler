/**
 * Self animations — abilities and consumables that affect the actor themselves.
 * Heal effects, buffs, stamina restoration, self-cures.
 */

import type { AnimationRef } from './types.js';

export const healingPulse = {
  id: 'fx.self.healing-pulse',
  category: 'self',
  durationMs: 1200,
} as const satisfies AnimationRef;

export const staminaSurge = {
  id: 'fx.self.stamina-surge',
  category: 'self',
  durationMs: 900,
} as const satisfies AnimationRef;

export const cureSparkle = {
  id: 'fx.self.cure-sparkle',
  category: 'self',
  durationMs: 1000,
} as const satisfies AnimationRef;

export const secondWindBuff = {
  id: 'fx.self.second-wind-buff',
  category: 'self',
  durationMs: 800,
} as const satisfies AnimationRef;

export const heatSurgeAura = {
  id: 'fx.self.heat-surge-aura',
  category: 'self',
  durationMs: 560,
} as const satisfies AnimationRef;
