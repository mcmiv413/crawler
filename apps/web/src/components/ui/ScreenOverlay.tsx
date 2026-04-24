import React from 'react';
import { screenOverlayStyle } from '../../styles.js';
import { Z_MODAL } from '../../config/ui-config.js';

interface ScreenOverlayProps {
  children: React.ReactNode;
  /** Override default Z_MODAL layer (e.g. for death/nemesis priority). */
  zIndex?: number;
}

/**
 * Full-screen overlay for narrative/game-state screens (death, nemesis,
 * quest-assigned, start). Uses colors.bg so it feels like part of the app
 * shell, not a transient dialog.
 */
export function ScreenOverlay({ children, zIndex = Z_MODAL }: ScreenOverlayProps) {
  return <div style={{ ...screenOverlayStyle, zIndex }}>{children}</div>;
}
