import type React from 'react';
import { BTN_MIN_HEIGHT, NAV_BTN_MIN_HEIGHT } from './config/ui-config.js';

export const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  margin: '3px 4px',
  background: '#333',
  color: '#ccc',
  border: '1px solid #555',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 14,
  minHeight: `${BTN_MIN_HEIGHT}px`,
  borderRadius: '4px',
};

export const navBtnStyle: React.CSSProperties = {
  ...btnStyle,
  flex: 1,
  textAlign: 'center',
  minHeight: `${NAV_BTN_MIN_HEIGHT}px`,
  borderRadius: 0,
};

export const rarityColor: Record<string, string> = {
  common: '#aaa', uncommon: '#4af', rare: '#a4f', epic: '#fa4', legendary: '#ff4',
};
