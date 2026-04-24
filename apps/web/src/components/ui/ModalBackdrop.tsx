import React from 'react';
import { Z_MODAL_BACKDROP } from '../../config/ui-config.js';
import { modalBackdropStyle } from '../../styles.js';

interface ModalBackdropProps {
  onClose: () => void;
  zIndex?: number;
  children?: React.ReactNode;
}

/**
 * Full-viewport dimmed backdrop that centers its children.
 *
 * Clicking the backdrop calls `onClose`. Children should call
 * `e.stopPropagation()` on their own click handlers (ModalCard already does).
 *
 * See DESIGN.md § Component Library — modal anatomy.
 */
export function ModalBackdrop({ onClose, zIndex = Z_MODAL_BACKDROP, children }: ModalBackdropProps) {
  return (
    <div
      style={{ ...modalBackdropStyle, zIndex }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}
