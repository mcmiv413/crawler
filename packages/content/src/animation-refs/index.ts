/**
 * Auto-generated animation reference catalog.
 * DO NOT EDIT — run pnpm generate:indexes to regenerate.
 *
 * The canonical catalog of all animation references.
 * Every animation ID literal (fx.category.name) is declared here.
 * Consumers must dot-walk through animationRefs to reference animations.
 */

import { radialImpactBurst, forwardSlash, cleaveArc as cleaveArcImpact, executionStrike, staggerShockwave, shatterBurst as shatterBurstImpact, riposteGlint, bleedingStrike, disarmStrike } from './impact.js';
import { singleArrow, arrowVolley, emberBolt } from './projectile.js';
import { healingPulse, staminaSurge, cureSparkle, secondWindBuff, heatSurgeAura } from './self.js';
import { bombBlast, cleaveArc as cleaveArcAoe, shatterBurst as shatterBurstAoe, cinderWake } from './aoe.js';
import { goldRingPulse } from './status.js';
import { trapSpark, trapPlacement } from './utility.js';

export const animationRefs = {
  impact: {
    radialImpactBurst,
    forwardSlash,
    cleaveArc: cleaveArcImpact,
    executionStrike,
    staggerShockwave,
    shatterBurst: shatterBurstImpact,
    riposteGlint,
    bleedingStrike,
    disarmStrike,
  },
  projectile: {
    singleArrow,
    arrowVolley,
    emberBolt,
  },
  self: {
    healingPulse,
    staminaSurge,
    cureSparkle,
    secondWindBuff,
    heatSurgeAura,
  },
  aoe: {
    bombBlast,
    cleaveArc: cleaveArcAoe,
    shatterBurst: shatterBurstAoe,
    cinderWake,
  },
  status: {
    goldRingPulse,
  },
  utility: {
    trapSpark,
    trapPlacement,
  },
} as const;

/** Flat O(1) lookup map of all animation refs by ID. Used by the presenter for fast ref resolution. */
export const ANIMATION_REF_BY_ID = new Map(
  [
    ...Object.values(animationRefs.impact),
    ...Object.values(animationRefs.projectile),
    ...Object.values(animationRefs.self),
    ...Object.values(animationRefs.aoe),
    ...Object.values(animationRefs.status),
    ...Object.values(animationRefs.utility),
  ].map(ref => [ref.id, ref] as const)
);

export type { AnimationRef, AnimationId, AnimationCategory } from './types.js';
