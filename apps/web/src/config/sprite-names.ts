/**
 * Centralized sprite name constants for type-safe sprite references.
 * Used throughout the app to render DawnLike sprites with IDE autocomplete support.
 */

export const SPRITE_NAMES = {
  // Stairs
  STAIRS_UP: 'large stairs up',
  STAIRS_DOWN: 'large stairs down',

  // Action buttons
  ACTION_WAIT: 'action_wait',
  ACTION_ATTACK: 'action_attack',
  ACTION_SWAP: 'action_swap',
  ACTION_ABILITY: 'action_ability',
  ACTION_INTERACT: 'action_interact',
  ACTION_USE: 'action_use',
  ACTION_INSPECT: 'action_inspect',
} as const;

// Type for valid sprite names (useful for validation)
export type SpriteName = typeof SPRITE_NAMES[keyof typeof SPRITE_NAMES];
