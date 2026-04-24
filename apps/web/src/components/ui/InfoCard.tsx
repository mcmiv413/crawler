import React from 'react';
import { colors, FONT_STACK } from '../../styles.js';

interface InfoCardProps {
  children: React.ReactNode;
  /** Border colour override (e.g. colors.blood for threat cards). */
  borderColor?: string;
  /** Background override (defaults to colors.inset). */
  bgColor?: string;
  /** Padding override (defaults to 8px 10px). */
  padding?: number | string;
  /** Extra margin-bottom to separate stacked cards. */
  marginBottom?: number;
  /** Extra overrides. */
  style?: React.CSSProperties;
}

/**
 * Standard inset card used within panels — rumours, threats, quest entries,
 * faction blocks, prep advice. Matches DESIGN.md inset styling.
 */
export function InfoCard({
  children,
  borderColor,
  bgColor,
  padding = '8px 10px',
  marginBottom,
  style,
}: InfoCardProps) {
  return (
    <div
      style={{
        background: bgColor ?? colors.inset,
        border: `1px solid ${borderColor ?? colors.border}`,
        borderRadius: '2px',
        padding,
        marginBottom,
        color: colors.text,
        fontFamily: FONT_STACK,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
