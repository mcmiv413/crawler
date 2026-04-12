import React from 'react';
import { DPAD_BTN_SIZE } from '../config/ui-config.js';

interface DPadProps {
  onDirection: (direction: 'N' | 'S' | 'E' | 'W') => void;
  disabled?: boolean;
}

const padBtn: React.CSSProperties = {
  width: DPAD_BTN_SIZE,
  height: DPAD_BTN_SIZE,
  fontSize: 20,
  background: '#222',
  color: '#aaa',
  border: '1px solid #555',
  borderRadius: 6,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
};

export function DPad({ onDirection, disabled }: DPadProps) {
  return (
    <div
      data-testid="dpad"
      style={{ display: 'inline-grid', gridTemplateColumns: `${DPAD_BTN_SIZE}px ${DPAD_BTN_SIZE}px ${DPAD_BTN_SIZE}px`, gap: 2, marginTop: 8 }}
    >
      <div />
      <button style={padBtn} onClick={() => onDirection('N')} disabled={disabled} aria-label="Move North">
        N
      </button>
      <div />
      <button style={padBtn} onClick={() => onDirection('W')} disabled={disabled} aria-label="Move West">
        W
      </button>
      <div />
      <button style={padBtn} onClick={() => onDirection('E')} disabled={disabled} aria-label="Move East">
        E
      </button>
      <div />
      <button style={padBtn} onClick={() => onDirection('S')} disabled={disabled} aria-label="Move South">
        S
      </button>
      <div />
    </div>
  );
}
