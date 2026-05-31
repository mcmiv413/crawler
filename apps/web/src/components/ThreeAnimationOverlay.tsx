/**
 * Lazy wrapper for the Three.js animation overlay.
 *
 * Keeps the heavy Three.js implementation off the default canvas render path.
 * The inner ThreeAnimationOverlay is only loaded when:
 *   - isEnabled is true
 *   - a map is present
 *   - at least one active Three-owned visual exists, or the persistent
 *     atmosphere vignette is enabled
 *
 * Import-boundary guardrail: this file must never directly import from
 * apps/web/src/rendering/three/ThreeAnimationOverlay.tsx.
 * That import is inside the React.lazy() call so it is truly deferred.
 */

import React from 'react';
import type { ThreeAnimationOverlayProps } from '../rendering/three/ThreeAnimationOverlay.js';

const LazyThreeAnimationOverlay = React.lazy(async () => {
  const [{ initializeThreeAnimationModules }, module] = await Promise.all([
    import('../rendering/three/generated/index.js'),
    import('../rendering/three/ThreeAnimationOverlay.js'),
  ]);
  initializeThreeAnimationModules();
  return { default: module.ThreeAnimationOverlay };
});

export function ThreeAnimationOverlay(props: ThreeAnimationOverlayProps): React.ReactElement | null {
  const hasAnimations =
    (props.moveAnimations?.length ?? 0) > 0
    || (props.bumpAnimations?.length ?? 0) > 0
    || props.consumableAnimations.length > 0
    || props.fxAnimations.length > 0
    || props.statusPresentations.some((presentation) => presentation.animationId !== undefined)
    || (props.defenderHits?.size ?? 0) > 0
    || props.combatIndicators.length > 0;

  const shouldLoad = props.isEnabled
    && props.map != null
    && (hasAnimations || (props.atmosphereEnabled ?? false));

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
