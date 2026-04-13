/**
 * Centralized icon definitions for action buttons.
 * Currently uses emoji; structured for future sprite migration.
 */

export type ActionButtonType = 'WAIT' | 'ATTACK' | 'SWAP' | 'ABILITY' | 'INTERACT' | 'USE' | 'INSPECT';

export interface ActionIcon {
  readonly emoji: string;
  readonly spriteKey?: string; // For future sprite-based rendering
  readonly tooltip: string;
}

export const ACTION_ICONS: Record<ActionButtonType, ActionIcon> = {
  WAIT: {
    emoji: '⏸️',
    spriteKey: 'action_wait',
    tooltip: 'Skip your turn',
  },
  ATTACK: {
    emoji: '⚔️',
    spriteKey: 'action_attack',
    tooltip: 'Attack selected enemy',
  },
  SWAP: {
    emoji: '🔄',
    spriteKey: 'action_swap',
    tooltip: 'Swap weapons',
  },
  ABILITY: {
    emoji: '✨',
    spriteKey: 'action_ability',
    tooltip: 'Use an ability',
  },
  INTERACT: {
    emoji: '🤝',
    spriteKey: 'action_interact',
    tooltip: 'Interact with objects',
  },
  USE: {
    emoji: '🧪',
    spriteKey: 'action_use',
    tooltip: 'Use consumable item',
  },
  INSPECT: {
    emoji: '🔍',
    spriteKey: 'action_inspect',
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
