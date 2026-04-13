/**
 * StairsDropdown - Shows Ascend and/or Retreat options when player is on stairs
 */

import React from 'react';
import styles from '../ActionOverlay.module.css';

interface StairsDropdownProps {
  readonly canAscend: boolean;
  readonly canRetreat: boolean;
  readonly onAscend: () => void;
  readonly onRetreat: () => void;
}

export function StairsDropdown({
  canAscend,
  canRetreat,
  onAscend,
  onRetreat,
}: StairsDropdownProps) {
  return (
    <div className={styles.dropdownContent}>
      {canAscend && (
        <button
          onClick={onAscend}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '10px 12px',
            border: 'none',
            background: 'transparent',
            color: '#0ff',
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2a2a4e';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span>📈 Ascend to Previous Floor</span>
        </button>
      )}
      {canRetreat && (
        <button
          onClick={onRetreat}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '10px 12px',
            border: 'none',
            background: 'transparent',
            color: '#ff8844',
            cursor: 'pointer',
            fontSize: '13px',
            textAlign: 'left',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2a2a4e';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span>🏃 Return to Town</span>
        </button>
      )}
    </div>
  );
}
