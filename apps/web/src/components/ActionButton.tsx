/**
 * ActionButton - Individual button in the UnifiedActionPanel.
 * Displays icon, label, and responds to clicks.
 */

import type { ActionButtonType } from '../config/action-icons';
import { ACTION_ICONS } from '../config/action-icons';
import { ItemSpriteIcon } from './ItemSpriteIcon';
import styles from './ActionButton.module.css';

export interface ActionButtonProps {
  readonly type: ActionButtonType;
  readonly label: string;
  readonly enabled: boolean;
  readonly isActive: boolean; // Whether dropdown is open
  readonly onClick: () => void;
  readonly iconElement?: React.ReactNode; // Optional custom icon override
}

export function ActionButton({
  type,
  label,
  enabled,
  isActive,
  onClick,
  iconElement,
}: ActionButtonProps) {
  const icon = ACTION_ICONS[type];

  // Determine what to render: custom override → sprite → emoji
  let renderedIcon = iconElement;
  if (!renderedIcon && icon.spriteName) {
    renderedIcon = <ItemSpriteIcon spriteName={icon.spriteName} size={16} />;
  }
  renderedIcon ??= icon.emoji;

  return (
    <button
      className={`${styles.button} ${isActive ? styles.active : ''} ${!enabled ? styles.disabled : ''}`}
      onClick={onClick}
      disabled={!enabled}
      title={icon.tooltip}
      aria-label={`${label}: ${icon.tooltip}`}
    >
      <div className={styles.icon}>{renderedIcon}</div>
      <div className={styles.label}>{label}</div>
    </button>
  );
}
