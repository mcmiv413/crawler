import React from 'react';
import { colors, FONT_STACK } from '../../styles.js';

interface PanelHeaderProps {
  title: string;
  /** Optional right-aligned meta text (e.g. floor number, status). */
  meta?: React.ReactNode;
  /** If provided, renders a close button on the right. Takes precedence over meta. */
  onClose?: () => void;
  /** Optional accent colour for the title label (defaults to colors.label). */
  accentColor?: string;
}

/**
 * Standard panel/modal header: inset bg, 7px vertical pad, uppercase 11px/600
 * label + right-aligned meta or close button.
 *
 * See DESIGN.md § Component Library — Panel Header anatomy.
 */
export function PanelHeader({ title, meta, onClose, accentColor }: PanelHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 12px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.inset,
        flexShrink: 0,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: accentColor ?? colors.label,
          fontFamily: FONT_STACK,
        }}
      >
        {title}
      </h2>
      {onClose ? (
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.muted,
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: '2px 6px',
            fontFamily: FONT_STACK,
          }}
        >
          ✕
        </button>
      ) : meta !== undefined ? (
        <span style={{ fontSize: 11, color: colors.muted, fontFamily: FONT_STACK }}>{meta}</span>
      ) : null}
    </div>
  );
}
