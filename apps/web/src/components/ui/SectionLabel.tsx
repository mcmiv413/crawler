import React from 'react';
import { colors, FONT_STACK } from '../../styles.js';

interface SectionLabelProps {
  label: string;
  /** Override default muted colour (e.g. for per-section themed label). */
  color?: string;
  /** Extra margin-top to separate from preceding content. */
  marginTop?: number;
}

/**
 * 10px/600 uppercase tracked label with a bottom border. Used to divide a
 * panel body into named groups.
 *
 * See DESIGN.md § Section Label.
 */
export function SectionLabel({ label, color, marginTop }: SectionLabelProps) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: color ?? colors.muted,
        marginTop,
        marginBottom: 7,
        paddingBottom: 4,
        borderBottom: `1px solid ${colors.border2}`,
        fontFamily: FONT_STACK,
      }}
    >
      {label}
    </div>
  );
}
