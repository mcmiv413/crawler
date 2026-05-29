import React from 'react';
import type { ThreeEffectsOverlayProps } from '../rendering/three/ThreeEffectsOverlay.js';

const LazyThreeEffectsOverlay = React.lazy(async () => {
  const module = await import('../rendering/three/ThreeEffectsOverlay.js');
  return { default: module.ThreeEffectsOverlay };
});

export function ThreeEffectsOverlay(props: ThreeEffectsOverlayProps): React.ReactElement {
  return (
    <React.Suspense fallback={null}>
      <LazyThreeEffectsOverlay {...props} />
    </React.Suspense>
  );
}

export type { ThreeEffectsOverlayProps };
