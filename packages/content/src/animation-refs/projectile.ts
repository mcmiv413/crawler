/**
 * Projectile animations — arrows, bolts, bullets that traverse from actor to target(s).
 * Key: suppressActorBump must be explicitly declared (typically true to show multiple projectiles).
 */

import type { AnimationRef } from './types.js';

export const singleArrow: AnimationRef = {
  id: 'fx.projectile.single-arrow',
  category: 'projectile',
  durationMs: 300,
  suppressActorBump: false,
};

export const arrowVolley: AnimationRef = {
  id: 'fx.projectile.arrow-volley',
  category: 'projectile',
  durationMs: 400,
  suppressActorBump: true,
};
