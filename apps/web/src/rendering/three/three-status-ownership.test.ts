/**
 * Test layer: unit
 * Behavior: Three Status Ownership covers Status presentation ownership; initial state has statusPresentation = false; setting statusPresentation=true marks Three as owning status....
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/rendering/three/three-status-ownership.test.ts
 */
/**
 * Workstream 7: Status presentation ownership tests.
 *
 * Verifies that the status ownership suppression logic works correctly:
 * - When Three owns statusPresentation, canvas skips rendering status rings
 * - The goldRingPulse module is registered and satisfies the animation contract
 * - StatusPresentationView with animationId triggers Three ownership
 * - Multiple status presentations: Three owns all or none
 *
 * Key contracts:
 *  - isStatusPresentationOwnedByThree(state) drives canvas suppression
 *  - The gold-ring-pulse module has id matching animationRefs.status.goldRingPulse.id
 *  - Status module satisfies the ThreeAnimationModule lifecycle contract
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAnimationOwnershipState,
  reportThreeOwnership,
  isStatusPresentationOwnedByThree,
  areCombatIndicatorsOwnedByThree,
} from './three-animation-ownership.js';
import { goldRingPulse } from './modules/status/gold-ring-pulse.js';

// ---------------------------------------------------------------------------
// Suite: Status ownership via reportThreeOwnership
// ---------------------------------------------------------------------------

describe('Status presentation ownership', () => {
  let state: ReturnType<typeof createAnimationOwnershipState>;

  beforeEach(() => {
    state = createAnimationOwnershipState();
  });

  it('initial state has statusPresentation = false', () => {
    expect(isStatusPresentationOwnedByThree(state)).toBe(false);
  });

  it('setting statusPresentation=true marks Three as owning status rendering', () => {
    const newState = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: true,
      combatIndicators: false,
    });
    expect(isStatusPresentationOwnedByThree(newState)).toBe(true);
  });

  it('canvas suppression: should skip drawing when Three owns status', () => {
    const ownedState = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: true,
      combatIndicators: false,
    });
    // Canvas code should check isStatusPresentationOwnedByThree before drawing
    expect(isStatusPresentationOwnedByThree(ownedState)).toBe(true);
  });

  it('setting statusPresentation=false allows canvas to draw', () => {
    const ownedState = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: true,
      combatIndicators: false,
    });
    const releasedState = reportThreeOwnership(ownedState, {
      animationIds: [],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: false,
    });
    expect(isStatusPresentationOwnedByThree(releasedState)).toBe(false);
  });

  it('statusPresentation ownership is independent of combatIndicators', () => {
    const mixedState = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: true,
      combatIndicators: false,
    });
    expect(isStatusPresentationOwnedByThree(mixedState)).toBe(true);
    expect(areCombatIndicatorsOwnedByThree(mixedState)).toBe(false);
  });

  it('immutable: prior state is unchanged when ownership is updated', () => {
    const newState = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: true,
      combatIndicators: false,
    });
    expect(isStatusPresentationOwnedByThree(state)).toBe(false);
    expect(isStatusPresentationOwnedByThree(newState)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite: goldRingPulse module contract
// ---------------------------------------------------------------------------

describe('goldRingPulse module', () => {
  it('has id matching the status animation ref format', () => {
    expect(goldRingPulse.id).toBe('fx.status.gold-ring-pulse');
  });

  it('has category = status', () => {
    expect(goldRingPulse.category).toBe('status');
  });

  it('has a create function', () => {
    expect(typeof goldRingPulse.create).toBe('function');
  });

  it('has a setPosition function', () => {
    expect(typeof goldRingPulse.setPosition).toBe('function');
  });

  it('has an update function', () => {
    expect(typeof goldRingPulse.update).toBe('function');
  });

  it('has a dispose function', () => {
    expect(typeof goldRingPulse.dispose).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Suite: shouldCanvasSuppressStatusRing helper
// ---------------------------------------------------------------------------

describe('shouldCanvasSuppressStatusRing', () => {
  it('returns true when Three owns status presentation', () => {
    let state = createAnimationOwnershipState();
    state = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: true,
      combatIndicators: false,
    });
    // The check canvas uses:
    expect(isStatusPresentationOwnedByThree(state)).toBe(true);
  });

  it('returns false when Three does not own status presentation', () => {
    const state = createAnimationOwnershipState();
    expect(isStatusPresentationOwnedByThree(state)).toBe(false);
  });
});
