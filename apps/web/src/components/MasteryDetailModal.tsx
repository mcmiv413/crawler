import React from 'react';
import { MASTERY_THRESHOLDS } from '@dungeon/content';
import { colors, FONT_STACK } from '../styles.js';

interface MasteryDetailModalProps {
  weaponType: string;
  progress: number;
  tier: number;
  onClose: () => void;
}

export function MasteryDetailModal({ weaponType, progress, tier, onClose }: MasteryDetailModalProps) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        background: colors.inset,
        border: `1px solid ${colors.border}`,
        borderRadius: '2px',
        fontFamily: FONT_STACK,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.purple,
              textTransform: 'capitalize',
            }}
          >
            {weaponType} Mastery
          </div>
          <div style={{ fontSize: 10, color: colors.muted }}>Tier {tier}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            padding: '2px 6px',
            background: 'transparent',
            color: colors.muted,
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: FONT_STACK,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 11, color: colors.text, marginBottom: 8, lineHeight: 1.4 }}>
        <div style={{ marginBottom: 6 }}>
          <div style={{ color: colors.lime, fontWeight: 600, marginBottom: 2, fontSize: 10 }}>
            Current Progress
          </div>
          <div>
            {progress} uses at Tier {tier}
          </div>
        </div>

        {tier === 0 && (
          <div>
            <div style={{ color: colors.gold, fontWeight: 600, marginBottom: 2, fontSize: 10 }}>
              Next Tier (T1)
            </div>
            <div>
              Progress: {progress} / {MASTERY_THRESHOLDS[1]} uses
            </div>
            <div style={{ marginTop: 2, color: colors.muted, fontSize: 10 }}>
              Reach {MASTERY_THRESHOLDS[1]} uses to unlock Tier 1
            </div>
          </div>
        )}

        {tier === 1 && (
          <div>
            <div style={{ color: colors.gold, fontWeight: 600, marginBottom: 2, fontSize: 10 }}>
              Next Tier (T2)
            </div>
            <div>
              Progress: {progress - MASTERY_THRESHOLDS[1]} /{' '}
              {MASTERY_THRESHOLDS[2] - MASTERY_THRESHOLDS[1]} uses
            </div>
            <div style={{ marginTop: 2, color: colors.muted, fontSize: 10 }}>
              Reach {MASTERY_THRESHOLDS[2]} total uses to unlock Tier 2
            </div>
          </div>
        )}

        {tier >= 2 && (
          <div style={{ color: colors.muted, fontStyle: 'italic' }}>
            Maximum mastery tier reached
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 10,
          color: colors.lime,
          borderTop: `1px solid ${colors.border2}`,
          paddingTop: 6,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Unlocked Benefits:</div>
        <div>• Increased damage with {weaponType}s</div>
        <div>• Better ability effectiveness</div>
      </div>
    </div>
  );
}
