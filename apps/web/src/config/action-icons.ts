/**
 * Centralized icon definitions for action buttons.
 * Currently uses emoji; structured for future sprite migration.
 */

import { SPRITE_NAMES } from './sprite-names';

export type ActionButtonType = 'WAIT' | 'ATTACK' | 'SWAP' | 'ABILITY' | 'INTERACT' | 'USE' | 'INSPECT';

export interface ActionIcon {
  readonly emoji: string;
  readonly spriteName?: string; // DawnLike sprite name for icon rendering
  readonly tooltip: string;
}

export const ACTION_ICONS: Record<ActionButtonType, ActionIcon> = {
  WAIT: {
    emoji: '⏸️',
    spriteName: SPRITE_NAMES.ACTION_WAIT,
    tooltip: 'Skip your turn',
  },
  ATTACK: {
    emoji: '⚔️',
    spriteName: SPRITE_NAMES.ACTION_ATTACK,
    tooltip: 'Attack selected enemy',
  },
  SWAP: {
    emoji: '🔄',
    spriteName: SPRITE_NAMES.ACTION_SWAP,
    tooltip: 'Swap weapons',
  },
  ABILITY: {
    emoji: '✨',
    spriteName: SPRITE_NAMES.ACTION_ABILITY,
    tooltip: 'Use an ability',
  },
  INTERACT: {
    emoji: '🤝',
    spriteName: SPRITE_NAMES.ACTION_INTERACT,
    tooltip: 'Interact with objects',
  },
  USE: {
    emoji: '🧪',
    spriteName: SPRITE_NAMES.ACTION_USE,
    tooltip: 'Use consumable item',
  },
  INSPECT: {
    emoji: '🔍',
    spriteName: SPRITE_NAMES.ACTION_INSPECT,
    tooltip: 'Inspect dungeon',
  },
};

// Ordered list of actions for consistent grid layout: Wait | Attack | Swap | Ability | Interact | Use | Inspect
export const ACTION_ORDER: readonly ActionButtonType[] = [
  'WAIT',
  'ATTACK',
  'SWAP',
  'ABILITY',
  'INTERACT',
  'USE',
  'INSPECT',
];
