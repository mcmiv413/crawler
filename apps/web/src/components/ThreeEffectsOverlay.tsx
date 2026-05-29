import React from 'react';
import { ThreeAnimationOverlay } from './ThreeAnimationOverlay.js';
import type { ThreeEffectsOverlayProps } from '../rendering/three/ThreeEffectsOverlay.js';

const EMPTY_COMBAT_INDICATORS = [] as const;

export function ThreeEffectsOverlay(props: ThreeEffectsOverlayProps): React.ReactElement | null {
  return (
    <ThreeAnimationOverlay
      {...props}
      combatIndicators={EMPTY_COMBAT_INDICATORS}
    />
  );
}

export type { ThreeEffectsOverlayProps };
