/**
 * Lazy wrapper for the Three.js animation overlay.
 *
 * Keeps the heavy Three.js implementation off the default canvas render path.
 * The inner ThreeAnimationOverlay is only loaded when:
 *   - isEnabled is true
 *   - a map is present
 *   - at least one active animation exists (consumable or fx)
 *
 * Import-boundary guardrail: this file must never directly import from
 * apps/web/src/rendering/three/ThreeAnimationOverlay.tsx.
 * That import is inside the React.lazy() call so it is truly deferred.
 */

import React from 'react';
import type { ThreeAnimationOverlayProps } from '../rendering/three/ThreeAnimationOverlay.js';

const LazyThreeAnimationOverlay = React.lazy(async () => {
  const module = await import('../rendering/three/ThreeAnimationOverlay.js');
  return { default: module.ThreeAnimationOverlay };
});

export function ThreeAnimationOverlay(props: ThreeAnimationOverlayProps): React.ReactElement | null {
  const hasAnimations =
    props.consumableAnimations.length > 0 || props.fxAnimations.length > 0;

  const shouldLoad = props.isEnabled && props.map != null && hasAnimations;

  if (!shouldLoad) {
    return null;
  }

  return (
    <React.Suspense fallback={null}>
      <LazyThreeAnimationOverlay {...props} />
    </React.Suspense>
  );
}

export type { ThreeAnimationOverlayProps };
