import type { BumpAnimationEntry, MoveAnimationEntry, ConsumableAnimationEntry, AbilityAnimationEntry } from '@dungeon/presenter';

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

/** Emit a consumable-use animation event (heal, buff, cure, damage). */
export function emitConsumableAnimation(animation: ConsumableAnimationEntry): void {
  window.dispatchEvent(new CustomEvent('consumable-animation', { detail: animation }));
}


/** Emit an ability animation event. */
export function emitAbilityAnimation(animation: AbilityAnimationEntry): void {
  window.dispatchEvent(new CustomEvent('ability-animation', { detail: animation }));
}
