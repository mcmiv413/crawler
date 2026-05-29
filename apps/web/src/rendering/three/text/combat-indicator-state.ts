/**
 * Combat indicator label state helpers.
 *
 * Pure functions for extracting and ordering combat label state for use by
 * both the DOM CombatIndicators component and the Three.js overlay.
 *
 * No React or Three.js imports — these work in any environment.
 *
 * Ownership / canvas suppression
 * --------------------------------
 * shouldCanvasSuppressCombatIndicators(state) returns true when the Three
 * overlay owns label rendering — DOM combat indicators should be hidden.
 */

import type { AnimationOwnershipState } from '../three-animation-ownership.js';
import { areCombatIndicatorsOwnedByThree } from '../three-animation-ownership.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CombatLabelEntry {
  readonly text: string;
  readonly entityId: string;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the label state array from raw label entries.
 *
 * Returns a new array without mutating the input.
 * Filters out entries without text.
 */
export function buildCombatLabelState(
  labels: readonly CombatLabelEntry[],
): readonly CombatLabelEntry[] {
  return labels.filter((l) => l.text.length > 0);
}

/**
 * Sort label entries by timestamp descending — most recent first.
 *
 * Returns a new sorted array without mutating the input.
 * Most recent label goes at index 0 (renders on top / highest z).
 */
export function sortLabelsByRecency(
  labels: readonly CombatLabelEntry[],
): readonly CombatLabelEntry[] {
  return [...labels].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Returns true when the DOM CombatIndicators component should be suppressed
 * because the Three.js overlay owns combat indicator rendering.
 */
export function shouldCanvasSuppressCombatIndicators(
  state: AnimationOwnershipState,
): boolean {
  return areCombatIndicatorsOwnedByThree(state);
}
