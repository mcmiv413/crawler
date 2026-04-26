/**
 * Add these constants to ui-config.ts, near BUMP_ANIMATION_DURATION_MS.
 */

// ── Movement Animation Durations ────────────────────────────────
// Each style has its own duration so heavier/slower styles feel distinct.
// The canvas renderer reads durationMs from the MoveAnimationEntry itself;
// these constants are the source of truth used in animation-sequence.ts.

/** Step animation — player only. Snappy, responsive. */
export const MOVE_ANIM_DURATION_STEP  = 140;

/** Slide animation — default enemy. Neutral glide. */
export const MOVE_ANIM_DURATION_SLIDE = 180;

/** Dart animation — wall_stalker. Explosive, fast. */
export const MOVE_ANIM_DURATION_DART  = 150;

/** Drift animation — rearline_anchor. Slow, deliberate. */
export const MOVE_ANIM_DURATION_DRIFT = 240;

/** Stomp animation — chokepoint_holder. Heavy, overshoots. */
export const MOVE_ANIM_DURATION_STOMP = 200;

/** Lurch animation — ambush_idle. Frozen then sudden. */
export const MOVE_ANIM_DURATION_LURCH = 220;

/** Stagger between successive entity move animations (ms). */
export const MOVE_ANIM_STAGGER_MS = 120;
