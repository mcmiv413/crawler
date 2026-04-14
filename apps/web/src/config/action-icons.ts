/**
 * Centralized icon definitions for action buttons.
 * Currently uses emoji; structured for future sprite migration.
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
    spriteName: 'action_wait',
    tooltip: 'Skip your turn',
  },
  ATTACK: {
    emoji: '⚔️',
    spriteName: 'action_attack',
    tooltip: 'Attack selected enemy',
  },
  SWAP: {
    emoji: '🔄',
    spriteName: 'action_swap',
    tooltip: 'Swap weapons',
  },
  ABILITY: {
    emoji: '✨',
    spriteName: 'action_ability',
    tooltip: 'Use an ability',
  },
  INTERACT: {
    emoji: '🤝',
    spriteName: 'action_interact',
    tooltip: 'Interact with objects',
  },
  USE: {
    emoji: '🧪',
    spriteName: 'action_use',
    tooltip: 'Use consumable item',
  },
  INSPECT: {
    emoji: '🔍',
    spriteName: 'action_inspect',
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
