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

/** Compact button style for control panels (filter/sort buttons) - reduces padding on mobile */
export const compactBtnStyle: React.CSSProperties = {
  padding: '2px 6px',
  margin: '2px 2px',
  background: '#333',
  color: '#ccc',
  border: '1px solid #555',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
  borderRadius: '4px',
};

/** Ultra-compact mobile button style - minimal padding for tight spaces */
export const compactBtnStyleMobile: React.CSSProperties = {
  padding: '2px 4px',
  margin: '2px 0px',
  background: '#333',
  color: '#ccc',
  border: '1px solid #555',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 10,
  borderRadius: '2px',
};

