import React from 'react';
import type { ThreeEffectsOverlayProps } from '../rendering/three/ThreeEffectsOverlay.js';
import { hasHandledThreeAnimation } from '../rendering/three-effect-metadata.js';

const LazyThreeEffectsOverlay = React.lazy(async () => {
  const module = await import('../rendering/three/ThreeEffectsOverlay.js');
  return { default: module.ThreeEffectsOverlay };
});

export function ThreeEffectsOverlay(props: ThreeEffectsOverlayProps): React.ReactElement | null {
  const shouldLoadOverlay = props.isEnabled
    && props.map !== null
    && hasHandledThreeAnimation(props.consumableAnimations, props.fxAnimations);

  if (!shouldLoadOverlay) {
    return null;
  }

  return (
    <React.Suspense fallback={null}>
      <LazyThreeEffectsOverlay {...props} />
    </React.Suspense>
  );
}

export type { ThreeEffectsOverlayProps };
