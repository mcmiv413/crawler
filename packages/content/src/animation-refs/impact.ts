/**
 * Impact animations — attack strikes, slashes, bursts, shockwaves.
 * These animate the moment of impact: charge to release, arc trajectories, radial explosions.
 */

import type { AnimationRef } from './types.js';

export const radialImpactBurst: AnimationRef = {
  id: 'fx.impact.radial-impact-burst',
  category: 'impact',
  durationMs: 400,
};

export const forwardSlash: AnimationRef = {
  id: 'fx.impact.forward-slash',
  category: 'impact',
  durationMs: 350,
};

export const cleaveArc: AnimationRef = {
  id: 'fx.impact.cleave-arc',
  category: 'impact',
  durationMs: 450,
};

export const executionStrike: AnimationRef = {
  id: 'fx.impact.execution-strike',
  category: 'impact',
  durationMs: 500,
};

export const staggerShockwave: AnimationRef = {
  id: 'fx.impact.stagger-shockwave',
  category: 'impact',
  durationMs: 380,
};

export const shatterBurst: AnimationRef = {
  id: 'fx.impact.shatter-burst',
  category: 'impact',
  durationMs: 420,
};

export const riposteGlint: AnimationRef = {
  id: 'fx.impact.riposte-glint',
  category: 'impact',
  durationMs: 320,
};

export const bleedingStrike: AnimationRef = {
  id: 'fx.impact.bleeding-strike',
  category: 'impact',
  durationMs: 400,
};

export const disarmStrike: AnimationRef = {
  id: 'fx.impact.disarm-strike',
  category: 'impact',
  durationMs: 380,
};
