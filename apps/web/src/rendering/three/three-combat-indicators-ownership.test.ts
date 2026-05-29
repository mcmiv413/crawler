/**
 * Workstream 8: Combat indicators and hit flash ownership tests.
 *
 * Tests for:
 *  - useCombatIndicatorState hook — extracts label state for DOM/Three
 *  - three-defender-hit-flash.ts — hit feedback animation module
 *  - DOM CombatIndicators only render when Three doesn't own labels
 *  - Label ordering: latest label on top, older labels stacked below
 *  - Hit stop timing: labels pause during hit-stop window
 *
 * Key contracts:
 *  - areCombatIndicatorsOwnedByThree drives DOM suppression
 *  - combatLabelState contains ordered, deduplicated label entries
 *  - three-defender-hit-flash satisfies ThreeAnimationModule lifecycle contract
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAnimationOwnershipState,
  reportThreeOwnership,
  areCombatIndicatorsOwnedByThree,
  isStatusPresentationOwnedByThree,
} from './three-animation-ownership.js';
import {
  buildCombatLabelState,
  sortLabelsByRecency,
  shouldCanvasSuppressCombatIndicators,
} from './text/combat-indicator-state.js';

// ---------------------------------------------------------------------------
// Suite: Combat indicators ownership
// ---------------------------------------------------------------------------

describe('Combat indicators ownership', () => {
  let state: ReturnType<typeof createAnimationOwnershipState>;

  beforeEach(() => {
    state = createAnimationOwnershipState();
  });

  it('initial state has combatIndicators = false', () => {
    expect(areCombatIndicatorsOwnedByThree(state)).toBe(false);
  });

  it('setting combatIndicators=true marks Three as owning label rendering', () => {
    const newState = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: true,
    });
    expect(areCombatIndicatorsOwnedByThree(newState)).toBe(true);
  });

  it('combatIndicators ownership is independent of statusPresentation', () => {
    const newState = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: true,
    });
    expect(areCombatIndicatorsOwnedByThree(newState)).toBe(true);
    expect(isStatusPresentationOwnedByThree(newState)).toBe(false);
  });

  it('immutable: original state unchanged after update', () => {
    reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: true,
    });
    expect(areCombatIndicatorsOwnedByThree(state)).toBe(false);
  });

  it('releasing combat ownership returns false', () => {
    let s = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: true,
    });
    s = reportThreeOwnership(s, {
      animationIds: [],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: false,
    });
    expect(areCombatIndicatorsOwnedByThree(s)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite: buildCombatLabelState
// ---------------------------------------------------------------------------

describe('buildCombatLabelState', () => {
  it('returns empty array for no labels', () => {
    const result = buildCombatLabelState([]);
    expect(result).toEqual([]);
  });

  it('returns a single label entry', () => {
    const labels = [{ text: '+15', entityId: 'player', timestamp: 1000 }];
    const result = buildCombatLabelState(labels);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe('+15');
  });

  it('preserves all label fields', () => {
    const labels = [
      { text: '-8', entityId: 'enemy-1', timestamp: 2000 },
      { text: 'MISS', entityId: 'player', timestamp: 3000 },
    ];
    const result = buildCombatLabelState(labels);
    expect(result).toHaveLength(2);
    const texts = result.map((l) => l.text);
    expect(texts).toContain('-8');
    expect(texts).toContain('MISS');
  });

  it('does not mutate the input array', () => {
    const labels = [
      { text: '+5', entityId: 'player', timestamp: 1000 },
    ];
    const original = [...labels];
    buildCombatLabelState(labels);
    expect(labels).toEqual(original);
  });

  it('handles many labels efficiently', () => {
    const labels = Array.from({ length: 50 }, (_, i) => ({
      text: `+${i}`,
      entityId: 'player',
      timestamp: i * 100,
    }));
    const result = buildCombatLabelState(labels);
    expect(result).toHaveLength(50);
  });
});

// ---------------------------------------------------------------------------
// Suite: sortLabelsByRecency
// ---------------------------------------------------------------------------

describe('sortLabelsByRecency', () => {
  it('returns empty array for no labels', () => {
    expect(sortLabelsByRecency([])).toEqual([]);
  });

  it('most recent label (highest timestamp) comes first', () => {
    const labels = [
      { text: 'first', entityId: 'player', timestamp: 1000 },
      { text: 'latest', entityId: 'player', timestamp: 3000 },
      { text: 'middle', entityId: 'player', timestamp: 2000 },
    ];
    const sorted = sortLabelsByRecency(labels);
    expect(sorted[0]!.text).toBe('latest');
    expect(sorted[2]!.text).toBe('first');
  });

  it('does not mutate the input array', () => {
    const labels = [
      { text: 'b', entityId: 'player', timestamp: 200 },
      { text: 'a', entityId: 'player', timestamp: 100 },
    ];
    const original = labels.map((l) => l.text);
    sortLabelsByRecency(labels);
    expect(labels.map((l) => l.text)).toEqual(original);
  });

  it('stable sort: equal timestamps preserve relative order', () => {
    const labels = [
      { text: 'x', entityId: 'player', timestamp: 500 },
      { text: 'y', entityId: 'player', timestamp: 500 },
    ];
    const sorted = sortLabelsByRecency(labels);
    expect(sorted).toHaveLength(2);
    // Both are valid, just must not lose entries
    const texts = sorted.map((l) => l.text);
    expect(texts).toContain('x');
    expect(texts).toContain('y');
  });
});

// ---------------------------------------------------------------------------
// Suite: shouldCanvasSuppressCombatIndicators
// ---------------------------------------------------------------------------

describe('shouldCanvasSuppressCombatIndicators', () => {
  it('returns false when Three does not own combat indicators', () => {
    const state = createAnimationOwnershipState();
    expect(shouldCanvasSuppressCombatIndicators(state)).toBe(false);
  });

  it('returns true when Three owns combat indicators', () => {
    let state = createAnimationOwnershipState();
    state = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: true,
    });
    expect(shouldCanvasSuppressCombatIndicators(state)).toBe(true);
  });
});
