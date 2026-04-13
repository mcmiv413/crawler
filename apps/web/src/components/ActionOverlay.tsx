/**
 * ActionOverlay - Slide-in dropdown container for action selections.
 * Supports cancel button, backdrop, and keyboard shortcuts.
 */

import { useEffect, useRef } from 'react';
import type { ActionButtonType } from '../config/action-icons';
import { ACTION_ICONS } from '../config/action-icons';
import styles from './ActionOverlay.module.css';

export interface ActionOverlayProps {
  readonly isOpen: boolean;
  readonly action: ActionButtonType | 'STAIRS' | null;
  readonly onCancel: () => void;
  readonly children: React.ReactNode;
}

export function ActionOverlay({ isOpen, action, onCancel, children }: ActionOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  // Handle backdrop click to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      onCancel();
    }
  };

  if (!isOpen || !action) {
    return null;
  }

  // Handle STAIRS specially since it's not in ACTION_ICONS
  const actionIcon = action === 'STAIRS'
    ? { emoji: '🪜', tooltip: 'Stairs' }
    : ACTION_ICONS[action];

  return (
    <div
      ref={overlayRef}
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`overlay-title-${action}`}
    >
      <div ref={contentRef} className={styles.container}>
        {/* Header with action title and close button */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>{actionIcon.emoji}</span>
            <h3 id={`overlay-title-${action}`} className={styles.title}>
              {action}
            </h3>
          </div>
          <button
            className={styles.closeButton}
            onClick={onCancel}
            aria-label="Close"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Content area */}
        <div className={styles.content}>{children}</div>

        {/* Cancel footer */}
        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Cancel (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
