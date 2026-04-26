import type { BumpAnimationEntry, MoveAnimationEntry } from '@dungeon/presenter';

/**
 * BumpAnimations is a stub — animation rendering happens on the canvas.
 */
export function BumpAnimations(): null {
  return null;
}

/** Emit a bump (attack lunge) animation event. */
export function emitBumpAnimation(animation: BumpAnimationEntry): void {
  window.dispatchEvent(new CustomEvent('bump-animation', { detail: animation }));
}

/** Emit a move (step) animation event. */
export function emitMoveAnimation(animation: MoveAnimationEntry): void {
  window.dispatchEvent(new CustomEvent('move-animation', { detail: animation }));
}
