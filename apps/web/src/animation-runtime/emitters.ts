import type {
  AbilityAnimationEntry,
  BumpAnimationEntry,
  CombatIndicatorEntry,
  ConsumableAnimationEntry,
  MoveAnimationEntry,
} from '@dungeon/presenter';

export const BUMP_ANIMATION_EVENT = 'bump-animation';
export const MOVE_ANIMATION_EVENT = 'move-animation';
export const CONSUMABLE_ANIMATION_EVENT = 'consumable-animation';
export const ABILITY_ANIMATION_EVENT = 'ability-animation';
export const COMBAT_INDICATOR_EVENT = 'combat-indicator';

function dispatchRuntimeEvent<T>(eventName: string, detail: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<T>(eventName, { detail }));
}

export function emitBumpAnimation(animation: BumpAnimationEntry): void {
  dispatchRuntimeEvent(BUMP_ANIMATION_EVENT, animation);
}

export function emitMoveAnimation(animation: MoveAnimationEntry): void {
  dispatchRuntimeEvent(MOVE_ANIMATION_EVENT, animation);
}

export function emitConsumableAnimation(animation: ConsumableAnimationEntry): void {
  dispatchRuntimeEvent(CONSUMABLE_ANIMATION_EVENT, animation);
}

export function emitAbilityAnimation(animation: AbilityAnimationEntry): void {
  dispatchRuntimeEvent(ABILITY_ANIMATION_EVENT, animation);
}

export function emitCombatIndicator(
  x: number,
  y: number,
  text: string,
  type: CombatIndicatorEntry['type'] = 'damage',
): void {
  dispatchRuntimeEvent(COMBAT_INDICATOR_EVENT, { x, y, text, type });
}
