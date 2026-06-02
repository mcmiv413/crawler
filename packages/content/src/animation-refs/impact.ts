/**
 * Impact animations — attack strikes, slashes, bursts, shockwaves.
 * These animate the moment of impact: charge to release, arc trajectories, radial explosions.
 */

import type { AnimationRef } from './types.js';

export const radialImpactBurst: AnimationRef = {
  id: 'fx.impact.radial-impact-burst',
  category: 'impact',
  durationMs: 400,
  impactFrameMs: 240,
  recoveryMs: 160,
  hitStopMs: 50,
  impactFlash: true,
};

export const forwardSlash: AnimationRef = {
  id: 'fx.impact.forward-slash',
  category: 'impact',
  durationMs: 350,
  impactFrameMs: 210,
  recoveryMs: 140,
};

export const cleaveArc: AnimationRef = {
  id: 'fx.impact.cleave-arc',
  category: 'impact',
  durationMs: 450,
  impactFrameMs: 270,
  recoveryMs: 180,
};

export const executionStrike: AnimationRef = {
  id: 'fx.impact.execution-strike',
  category: 'impact',
  durationMs: 500,
  impactFrameMs: 300,
  recoveryMs: 200,
  hitStopMs: 80,
  impactFlash: true,
};

export const staggerShockwave: AnimationRef = {
  id: 'fx.impact.stagger-shockwave',
  category: 'impact',
  durationMs: 380,
  impactFrameMs: 228,
  recoveryMs: 152,
  hitStopMs: 40,
  impactFlash: true,
};

export const shatterBurst: AnimationRef = {
  id: 'fx.impact.shatter-burst',
  category: 'impact',
  durationMs: 420,
  impactFrameMs: 252,
  recoveryMs: 168,
  hitStopMs: 50,
  impactFlash: true,
};

export const riposteGlint: AnimationRef = {
  id: 'fx.impact.riposte-glint',
  category: 'impact',
  durationMs: 320,
  impactFrameMs: 192,
  recoveryMs: 128,
};

export const bleedingStrike: AnimationRef = {
  id: 'fx.impact.bleeding-strike',
  category: 'impact',
  durationMs: 400,
  impactFrameMs: 240,
  recoveryMs: 160,
  hitStopMs: 50,
  impactFlash: true,
};

export const disarmStrike: AnimationRef = {
  id: 'fx.impact.disarm-strike',
  category: 'impact',
  durationMs: 380,
  impactFrameMs: 228,
  recoveryMs: 152,
};

export const lightningStrike: AnimationRef = {
  id: 'fx.impact.lightning-strike',
  category: 'impact',
  durationMs: 360,
  impactFrameMs: 180,
  recoveryMs: 180,
  hitStopMs: 60,
  impactFlash: true,
};
