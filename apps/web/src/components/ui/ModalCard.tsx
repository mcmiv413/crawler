import React from 'react';
import { modalCardStyle } from '../../styles.js';
import { PanelHeader } from './PanelHeader.js';

interface ModalCardProps {
  children: React.ReactNode;
  /** Title rendered in the PanelHeader. If absent, no header is rendered. */
  title?: string;
  /** Close handler — when present, the header shows a close button. */
  onClose?: () => void;
  /** Accent colour for the header title (per-modal themed). */
  accentColor?: string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  /** Extra overrides layered on top of modalCardStyle. */
  style?: React.CSSProperties;
}

/**
 * Panel-styled modal card: inset header + scrollable body. Stops click
 * propagation so clicks inside don't close via backdrop.
 *
 * Consumers wrap content in this and a `ModalBackdrop`:
 * ```
 * <ModalBackdrop onClose={close}>
 *   <ModalCard title="QUESTS" onClose={close}>
 *     …body content…
 *   </ModalCard>
 * </ModalBackdrop>
 * ```
 */
export function ModalCard({
  children,
  title,
  onClose,
  accentColor,
  maxWidth,
  maxHeight,
  style,
}: ModalCardProps) {
  return (
    <div
      style={{
        ...modalCardStyle,
        ...(maxWidth !== undefined ? { maxWidth } : {}),
        ...(maxHeight !== undefined ? { maxHeight } : {}),
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {title !== undefined && (
        <PanelHeader title={title} onClose={onClose} accentColor={accentColor} />
      )}
      <div
        style={{
          padding: '12px 14px',
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
