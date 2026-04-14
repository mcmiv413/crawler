/**
 * Centralized icon definitions for action buttons.
 * Uses emoji for action icons (action button sprites don't exist in DawnLike atlas).
 * Stairs uses custom icon override in UnifiedActionPanel.
 */

export type ActionButtonType = 'WAIT' | 'ATTACK' | 'SWAP' | 'ABILITY' | 'INTERACT' | 'USE' | 'INSPECT';

export interface ActionIcon {
  readonly emoji: string;
  readonly spriteName?: string; // DawnLike sprite name for icon rendering
  readonly tooltip: string;
}

export const ACTION_ICONS: Record<ActionButtonType, ActionIcon> = {
  WAIT: {
    emoji: '⏸️',
    tooltip: 'Skip your turn',
  },
  ATTACK: {
    emoji: '⚔️',
    tooltip: 'Attack selected enemy',
  },
  SWAP: {
    emoji: '🔄',
    tooltip: 'Swap weapons',
  },
  ABILITY: {
    emoji: '✨',
    tooltip: 'Use an ability',
  },
  INTERACT: {
    emoji: '🤝',
    tooltip: 'Interact with objects',
  },
  USE: {
    emoji: '🧪',
    tooltip: 'Use consumable item',
  },
  INSPECT: {
    emoji: '🔍',
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
