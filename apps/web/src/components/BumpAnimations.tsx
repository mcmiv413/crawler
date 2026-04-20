import type { BumpAnimationEntry } from '@dungeon/presenter';

/**
 * BumpAnimations component is now a stub that only emits bump animation events.
 * The actual animation rendering happens on the canvas via useBumpAnimationState hook.
 */
export function BumpAnimations(): null {
  return null;
}

// Helper to emit bump animation events
export function emitBumpAnimation(animation: BumpAnimationEntry) {
  const event = new CustomEvent('bump-animation', {
    detail: animation,
  });
  window.dispatchEvent(event);
}
