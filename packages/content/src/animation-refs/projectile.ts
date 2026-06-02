/**
 * Projectile animations — arrows, bolts, bullets that traverse from actor to target(s).
 * Key: suppressActorBump must be explicitly declared (typically true to show multiple projectiles).
 */

import type { AnimationRef } from './types.js';

export const singleArrow: AnimationRef = {
  id: 'fx.projectile.single-arrow',
  category: 'projectile',
  durationMs: 300,
  impactFrameMs: 240,
  recoveryMs: 60,
  suppressActorBump: false,
};

export const arrowVolley: AnimationRef = {
  id: 'fx.projectile.arrow-volley',
  category: 'projectile',
  durationMs: 400,
  impactFrameMs: 320,
  recoveryMs: 80,
  suppressActorBump: true,
};

export const emberBolt: AnimationRef = {
  id: 'fx.projectile.ember-bolt',
  category: 'projectile',
  durationMs: 360,
  impactFrameMs: 288,
  recoveryMs: 72,
  suppressActorBump: true,
};

export const lightningBolt: AnimationRef = {
  id: 'fx.projectile.lightning-bolt',
  category: 'projectile',
  durationMs: 320,
  impactFrameMs: 256,
  recoveryMs: 64,
  suppressActorBump: true,
};
