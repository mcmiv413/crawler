/**
 * AOE animations — blast radius effects, explosions, area-of-effect bursts.
 * Key: suppressActorBump must be explicitly declared.
 */

import type { AnimationRef } from './types.js';

export const bombBlast = {
  id: 'fx.aoe.bomb-blast',
  category: 'aoe',
  durationMs: 800,
  suppressActorBump: false,
} as const satisfies AnimationRef;

export const cleaveArc = {
  id: 'fx.aoe.cleave-arc',
  category: 'aoe',
  durationMs: 450,
  suppressActorBump: false,
} as const satisfies AnimationRef;

export const shatterBurst = {
  id: 'fx.aoe.shatter-burst',
  category: 'aoe',
  durationMs: 420,
  suppressActorBump: false,
} as const satisfies AnimationRef;

export const cinderWake = {
  id: 'fx.aoe.cinder-wake',
  category: 'aoe',
  durationMs: 520,
  suppressActorBump: true,
} as const satisfies AnimationRef;
