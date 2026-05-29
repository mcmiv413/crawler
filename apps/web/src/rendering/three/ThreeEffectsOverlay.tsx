import React from 'react';
import type { ThreeAnimationOverlayProps } from './ThreeAnimationOverlay.js';
import { ThreeAnimationOverlay } from './ThreeAnimationOverlay.js';

export type ThreeEffectsOverlayProps = Omit<
  ThreeAnimationOverlayProps,
  'combatIndicators' | 'defenderHits' | 'onOwnershipChange'
>;

const EMPTY_COMBAT_INDICATORS: ThreeAnimationOverlayProps['combatIndicators'] = [];

/**
 * Legacy compatibility export for callers still importing ThreeEffectsOverlay.
 *
 * All runtime ownership now flows through ThreeAnimationOverlay and the
 * generated animation registry. Legacy callers do not have combat indicator or
 * defender-hit inputs, so this wrapper provides empty values for them.
 */
export function ThreeEffectsOverlay(props: ThreeEffectsOverlayProps): React.ReactElement | null {
  return (
    <ThreeAnimationOverlay
      {...props}
      combatIndicators={EMPTY_COMBAT_INDICATORS}
    />
  );
}
