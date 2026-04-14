/**
 * Centralized sprite name constants for type-safe sprite references.
 * Used throughout the app to render DawnLike sprites with IDE autocomplete support.
 */

export const SPRITE_NAMES = {
  // Stairs - using right-facing variants for UI
  STAIRS_UP: 'staircase up right',
  STAIRS_DOWN: 'staircase down right',

  // Action buttons
  ACTION_WAIT: 'action_wait',
  ACTION_ATTACK: 'action_attack',
  ACTION_SWAP: 'action_swap',
  ACTION_ABILITY: 'action_ability',
  ACTION_INTERACT: 'action_interact',
  ACTION_USE: 'action_use',
  ACTION_INSPECT: 'action_inspect',

  // Interaction objects
  OBJECT_CHEST: 'closed chest',
  OBJECT_FOUNTAIN: 'fountain',
  OBJECT_ALTAR: 'arcane altar',
  OBJECT_DOOR: 'closed stone door front',
  OBJECT_FIREPIT: 'lava pool right',
} as const;

// Type for valid sprite names (useful for validation)
export type SpriteName = typeof SPRITE_NAMES[keyof typeof SPRITE_NAMES];
