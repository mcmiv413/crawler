import React from 'react';
import type { WeaponMasteryView } from '@dungeon/presenter';
import { MASTERY_THRESHOLDS } from '@dungeon/content';

interface MasteryDetailModalProps {
  weaponType: string;
  progress: number;
  tier: number;
  onClose: () => void;
}

export function MasteryDetailModal({ weaponType, progress, tier, onClose }: MasteryDetailModalProps) {
  return (
    <div style={{ marginBottom: 12, padding: 8, background: '#1a3a2a', border: '1px solid #2a6a3a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#6af', textTransform: 'capitalize' }}>
            {weaponType} Mastery
          </div>
          <div style={{ fontSize: 10, color: '#888' }}>Tier {tier}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '2px 6px',
            background: '#333',
            color: '#aaa',
            border: '1px solid #555',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, lineHeight: 1.4 }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ color: '#4f4', fontWeight: 'bold', marginBottom: 2 }}>Current Progress</div>
          <div>{progress} uses at Tier {tier}</div>
        </div>

        {tier === 0 && (
          <div>
            <div style={{ color: '#fa4', fontWeight: 'bold', marginBottom: 2 }}>Next Tier (T1)</div>
            <div>Progress: {progress} / {MASTERY_THRESHOLDS[1]} uses</div>
            <div style={{ marginTop: 2, color: '#888' }}>Reach {MASTERY_THRESHOLDS[1]} uses to unlock Tier 1</div>
          </div>
        )}

        {tier === 1 && (
          <div>
            <div style={{ color: '#fa4', fontWeight: 'bold', marginBottom: 2 }}>Next Tier (T2)</div>
            <div>Progress: {progress - MASTERY_THRESHOLDS[1]} / {MASTERY_THRESHOLDS[2] - MASTERY_THRESHOLDS[1]} uses</div>
            <div style={{ marginTop: 2, color: '#888' }}>Reach {MASTERY_THRESHOLDS[2]} total uses to unlock Tier 2</div>
          </div>
        )}

        {tier >= 2 && (
          <div style={{ color: '#888', fontStyle: 'italic' }}>
            Maximum mastery tier reached
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: '#6f6', borderTop: '1px solid #2a6a3a', paddingTop: 6 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Unlocked Benefits:</div>
        <div>• Increased damage with {weaponType}s</div>
        <div>• Better ability effectiveness</div>
      </div>
    </div>
  );
}
